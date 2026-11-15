-- =====================================================================
-- SUB-20 — V4: NACRT TABELA (F9 etapa 1, 14. 11. 2026)
--
-- ZAMENJEN (14. 11. 2026): primenjeno stanje je u supabase/v4.sql, a deo koji
-- je primenjen 15. 11. 2026 u izmenjenom obliku (v. supabase/v4.sql; nekadašnji v4-ceka-potvrdu.sql je obrisan). Ovaj fajl se
-- čuva samo kao istorija nacrta.
--
-- NACRT. NE IZVRŠAVATI. Izvršava se tek u F9 koraku 5, na Supabase GRANI,
-- posle izričitog „kreni" vlasnika (odluka F8 § 9.2 daje odobrenje za izmene
-- baze, ali tek u F9). `user_state`, `user_state_istorija` i v2 podaci se
-- NE diraju.
--
-- Uzor: supabase/user-state.sql (svaka politika `auth.uid() = user_id`,
-- `using` + `with check`), supabase/istorija.sql (istoriju piše samo okidač,
-- `security definer`, nema politike za izmenu/brisanje).
--
-- Posle puštanja: dopuniti `api/delete-account.js` TABELE,
-- `supabase/brisi-nalog.sql` spisak i `supabase/provera.sql`.
--
-- VRAĆANJE NAZAD (cela V4 baza): zastavica `v4_pristup.ukljuceno = false`
-- vraća aplikaciju na `user_state` bez gubitka. Potpuno uklanjanje:
--   drop table public.plan_v4_verzija, public.plan_v4_dogadjaj,
--              public.plan_v4, public.aktivnost, public.v4_pristup cascade;
--   drop function public.plan_v4_zapamti(), public.plan_v4_rev(),
--                 public.v4_iskljuci();
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. aktivnost — jedno trčanje = jedan red (SPEC § 2.2 `Run`)
--   piše:   uređaj korisnika (Strava uvoz, ručni unos), upsert po (user_id, id)
--           — dva uređaja koja povuku isto trčanje daju isti red, sukoba nema
--   čita:   svoj red; service_role (senka, F8 § 7 korak 0)
--   veličina: ≈ 19 KB po korisniku za 26 nedelja [niska, F8 § 6.1]
--   nazad:  drop; trčanja i dalje postoje na Stravi i u `user_state.log`
-- ---------------------------------------------------------------------
create table if not exists public.aktivnost (
  user_id     uuid        not null references auth.users(id) on delete cascade,
  id          text        not null,              -- 'strava:1234567890' | 'rucno:<uuid>'
  datum       date        not null,              -- lokalni dan početka (Beograd)
  run         jsonb       not null,              -- ceo `Run` bez `planned` (popunjava motor)
  izvor       text        not null default 'strava',
  device_id   text,
  updated_at  timestamptz not null default now(),
  primary key (user_id, id),
  constraint aktivnost_run_obj check (jsonb_typeof(run) = 'object'),
  constraint aktivnost_run_mali check (pg_column_size(run) < 32768)
);
create index if not exists aktivnost_po_datumu on public.aktivnost (user_id, datum desc);

alter table public.aktivnost enable row level security;
drop policy if exists aktivnost_citaj on public.aktivnost;
create policy aktivnost_citaj on public.aktivnost for select using (auth.uid() = user_id);
drop policy if exists aktivnost_upisi on public.aktivnost;
create policy aktivnost_upisi on public.aktivnost for insert with check (auth.uid() = user_id);
drop policy if exists aktivnost_menjaj on public.aktivnost;
create policy aktivnost_menjaj on public.aktivnost for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Brisanje dozvoljeno: korisnik briše ručno uneto ili trčanje obrisano na Stravi.
drop policy if exists aktivnost_brisi on public.aktivnost;
create policy aktivnost_brisi on public.aktivnost for delete using (auth.uid() = user_id);
grant select, insert, update, delete on public.aktivnost to authenticated;
revoke all on public.aktivnost from anon;


-- ---------------------------------------------------------------------
-- 2. plan_v4 — jedan aktivan `PlanDoc` po korisniku
--   piše:   uređaj; USLOVNO: PATCH ?user_id=eq.<uid>&rev=eq.<videni>
--           — 0 izmenjenih redova = neko je upisao posle nas → ponovo učitaj
--           i ponovo primeni svoju radnju (F8 § 6.3). `rev` diže okidač.
--   čita:   svoj red
--   veličina: 24–41 KB [visoka, mereno F8 § 6.2]
--   nazad:  zastavica isključena → app čita `genPlan` kao danas
-- ---------------------------------------------------------------------
create table if not exists public.plan_v4 (
  user_id     uuid        primary key references auth.users(id) on delete cascade,
  doc         jsonb       not null,
  rev         bigint      not null default 1,
  otisak      text        not null,              -- `fingerprint(doc)`; isti otisak = nije sukob
  engine_ver  text        not null,
  device_id   text,
  updated_at  timestamptz not null default now(),
  constraint plan_v4_doc_obj check (jsonb_typeof(doc) = 'object'),
  constraint plan_v4_doc_mali check (pg_column_size(doc) < 262144)
);

create or replace function public.plan_v4_rev()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    new.rev := old.rev + 1;
  else
    new.rev := 1;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists plan_v4_rev_trg on public.plan_v4;
create trigger plan_v4_rev_trg before insert or update on public.plan_v4
  for each row execute function public.plan_v4_rev();

alter table public.plan_v4 enable row level security;
drop policy if exists plan_v4_citaj on public.plan_v4;
create policy plan_v4_citaj on public.plan_v4 for select using (auth.uid() = user_id);
drop policy if exists plan_v4_upisi on public.plan_v4;
create policy plan_v4_upisi on public.plan_v4 for insert with check (auth.uid() = user_id);
drop policy if exists plan_v4_menjaj on public.plan_v4;
create policy plan_v4_menjaj on public.plan_v4 for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Bez politike za delete: „Generiši nov plan" PREPISUJE doc (stari ide u verzije).
grant select, insert, update on public.plan_v4 to authenticated;
revoke all on public.plan_v4 from anon;


-- ---------------------------------------------------------------------
-- 3. plan_v4_verzija — prethodne verzije, najviše 10 (uzor istorija.sql)
--   piše:   SAMO okidač (security definer); kroz RLS niko
--   čita:   svoj red („Ranije verzije plana")
--   veličina: ≤ 10 × 41 KB ≈ 0,4 MB [niska]
--   nazad:  vraćanje verzije = uslovni upis starog `doc` u plan_v4
-- ---------------------------------------------------------------------
create table if not exists public.plan_v4_verzija (
  id          bigint generated always as identity primary key,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  rev         bigint      not null,
  doc         jsonb       not null,
  otisak      text        not null,
  sacuvano    timestamptz not null default now()
);
create index if not exists plan_v4_verzija_po_korisniku on public.plan_v4_verzija (user_id, id desc);

create or replace function public.plan_v4_zapamti()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    if old.otisak is distinct from new.otisak then
      insert into public.plan_v4_verzija (user_id, rev, doc, otisak)
        values (old.user_id, old.rev, old.doc, old.otisak);
      delete from public.plan_v4_verzija
       where user_id = old.user_id
         and id not in (select id from public.plan_v4_verzija
                         where user_id = old.user_id order by id desc limit 10);
    end if;
  exception when others then
    null;  -- istorija nikad ne obara upis plana (kao istorija.sql)
  end;
  return new;
end $$;
drop trigger if exists plan_v4_zapamti_trg on public.plan_v4;
create trigger plan_v4_zapamti_trg after update on public.plan_v4
  for each row execute function public.plan_v4_zapamti();

alter table public.plan_v4_verzija enable row level security;
drop policy if exists plan_v4_verzija_citaj on public.plan_v4_verzija;
create policy plan_v4_verzija_citaj on public.plan_v4_verzija for select using (auth.uid() = user_id);
grant select on public.plan_v4_verzija to authenticated;
revoke all on public.plan_v4_verzija from anon;
revoke execute on function public.plan_v4_zapamti() from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 4. plan_v4_dogadjaj — izričiti događaji, SAMO DOPISIVANJE (F8 § 6.2)
--   vrsta: pain | fatigue | pause | goal-change | availability-change |
--          manual-edit | odbijeno | primenjeno
--   piše:   uređaj, samo insert; `event_id` = determinističan `PlanEvent.id`,
--           pa dvostruki upis istog događaja ne pravi duplikat
--   čita:   svoj red
--   veličina: ≈ 100–300 B po događaju [niska]
--   nazad:  ne briše se; motor ga čita pri ponovnom planiranju
-- ---------------------------------------------------------------------
create table if not exists public.plan_v4_dogadjaj (
  id          bigint generated always as identity primary key,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  event_id    text        not null,
  vrsta       text        not null,
  dogadjaj    jsonb       not null,              -- ceo `PlanEvent`
  rev_plana   bigint,                            -- nad kojom verzijom plana je primenjen
  device_id   text,
  napravljeno timestamptz not null default now(),
  unique (user_id, event_id, vrsta)
);
create index if not exists plan_v4_dogadjaj_po_korisniku on public.plan_v4_dogadjaj (user_id, napravljeno);

alter table public.plan_v4_dogadjaj enable row level security;
drop policy if exists plan_v4_dogadjaj_citaj on public.plan_v4_dogadjaj;
create policy plan_v4_dogadjaj_citaj on public.plan_v4_dogadjaj for select using (auth.uid() = user_id);
drop policy if exists plan_v4_dogadjaj_upisi on public.plan_v4_dogadjaj;
create policy plan_v4_dogadjaj_upisi on public.plan_v4_dogadjaj for insert with check (auth.uid() = user_id);
-- Nema update/delete: zapis koji se može obrisati iz aplikacije ne štiti od greške U aplikaciji.
grant select, insert on public.plan_v4_dogadjaj to authenticated;
revoke all on public.plan_v4_dogadjaj from anon;


-- ---------------------------------------------------------------------
-- 5. v4_pristup — zastavica po korisniku, NA SERVERU
--   piše:   service_role / SQL vlasnika (uključenje); korisnik samo ISKLJUČUJE
--           kroz `v4_iskljuci()`
--   čita:   svoj red; bez reda = V4 isključen
--   veličina: 1 red
--   nazad:  update public.v4_pristup set ukljuceno = false;   (svima ili jednom)
-- ---------------------------------------------------------------------
create table if not exists public.v4_pristup (
  user_id     uuid        primary key references auth.users(id) on delete cascade,
  ukljuceno   boolean     not null default false,
  od          timestamptz not null default now(),
  napomena    text
);

alter table public.v4_pristup enable row level security;
drop policy if exists v4_pristup_citaj on public.v4_pristup;
create policy v4_pristup_citaj on public.v4_pristup for select using (auth.uid() = user_id);
grant select on public.v4_pristup to authenticated;
revoke all on public.v4_pristup from anon;

create or replace function public.v4_iskljuci()
returns void language sql security definer set search_path = public as $$
  update public.v4_pristup set ukljuceno = false, od = now() where user_id = auth.uid();
$$;
revoke all on function public.v4_iskljuci() from public, anon;
grant execute on function public.v4_iskljuci() to authenticated;

-- Uključenje samo vlasniku (korak 9; UID iz web/src/services/config.ts ADMIN_UID):
--   insert into public.v4_pristup (user_id, ukljuceno, napomena)
--   values ('<ADMIN_UID>', true, 'proba vlasnika')
--   on conflict (user_id) do update set ukljuceno = true, od = now();
-- Uključenje svima (korak 10):
--   insert into public.v4_pristup (user_id, ukljuceno)
--   select id, true from auth.users
--   on conflict (user_id) do update set ukljuceno = true, od = now();
