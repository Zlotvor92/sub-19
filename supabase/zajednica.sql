-- =====================================================================
-- SUB-20 — ZAJEDNICA
--
-- ŠTA JE
-- Dobrovoljna, javna (unutar aplikacije) rang-lista trkača. Ko je uključi,
-- vidi ostale koji su je uključili — i njega vide oni. Ko je ne uključi, ne
-- postoji u njoj i ne vidi nikoga.
--
-- ZAŠTO JE OPT-IN, A NE OPT-OUT
-- Do ovog fajla je politika privatnosti tvrdila da podacima pristupaš SAMO ti.
-- Zajednica to menja, pa promena ne sme da se desi nikome ko je nije tražio.
-- Podrazumevano `vidljiv = false` je jedina odbrana koja to jemči iz baze, a
-- ne iz koda aplikacije koji se sutra prepravi.
--
-- ŠTA NIKAD NE ULAZI U OVU TABELU
-- HRV, puls u miru, san, težina, mapa bolova, beleške sa treninga, AI analiza
-- i E-ADRESA. Ne postoje kao kolone — dakle ne mogu da iscure ni greškom u
-- aplikaciji. To je namerno; kolona koje nema je jača zaštita od provere koja
-- se zaboravi.
--
-- KAKO SE PUŠTA
-- Supabase → SQL Editor → nalepi CEO ovaj fajl → Run. Traje sekund.
-- Puštanje dvaput je bezbedno (sve je `if not exists` / `create or replace`).
--
-- ŠTA NE DIRA
-- `user_state`, `push_pretplata`, `ai_posao`, `api_usage`, `bug_report_usage`
-- i `endpoint_usage` ostaju netaknute.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Profil
--
-- Brojeve upisuje APLIKACIJA, iz svog stanja. To znači da su na poverenje:
-- ko hoće da precrta VDOT, može, u granicama `check` opsega ispod.
--
-- Alternativa je bila `security definer` funkcija koja sama čita
-- `user_state.data` i računa VDOT, doslednost i niz. Neprobojno — ali bi
-- značilo DRUGU implementaciju `currentVdot()` i `weekPlanKm()`, napisanu u
-- SQL-u, nad JSON-om čiji se oblik menja sa svakom šemom. Te dve bi se
-- razišle i to se ne bi videlo: brojevi bi i dalje izlazili, samo pogrešni.
-- Ovo je lista ljudi koji trče, ne rang-lista za novac. `check` opsezi
-- zaustavljaju besmislice, a poverenje pokriva ostalo.
--
-- Opseg VDOT-a (20–85) je ISTI onaj koji `cilJTempoDana` u app.js koristi kao
-- granicu razumnog. Ako se negde promeni, mora i ovde.
-- ---------------------------------------------------------------------
create table if not exists public.zajednica_profil (
  user_id     uuid    primary key references auth.users(id) on delete cascade,
  vidljiv     boolean not null default false,
  nadimak     text    check (nadimak is null or char_length(btrim(nadimak)) between 2 and 24),
  -- Slika ide pravo u `img src`. Ograničenje na https URL sprečava da se u
  -- atribut upiše shema koja to nije (`data:`, `javascript:`).
  avatar_url  text    check (avatar_url is null or avatar_url ~ '^https://[a-zA-Z0-9.-]+/'),
  cilj        text    check (cilj is null or cilj in ('5K','10K','21K','42K')),
  trka_datum  date,
  vdot        numeric(4,1) check (vdot is null or vdot between 20 and 85),
  test3k_sec  integer      check (test3k_sec is null or test3k_sec between 480 and 1800),
  km_nedelja  numeric(6,1) check (km_nedelja is null or km_nedelja between 0 and 300),
  plan_pct    integer      check (plan_pct is null or plan_pct between 0 and 100),
  niz_dana    integer      check (niz_dana is null or niz_dana between 0 and 3650),
  znacke      text[]  not null default '{}'::text[]
                      check (array_length(znacke, 1) is null or array_length(znacke, 1) <= 20),
  azurirano   timestamptz not null default now()
);

comment on table public.zajednica_profil is
  'Dobrovoljan javni profil trkača. Podrazumevano nevidljiv. Nema nijedno zdravstveno polje ni e-adresu.';

-- Spisak uvek čita samo vidljive. Delimičan indeks je manji od punog i
-- pokriva tačno taj jedan upit.
create index if not exists zajednica_profil_vidljiv_idx
  on public.zajednica_profil (vidljiv) where vidljiv;


-- ---------------------------------------------------------------------
-- 2. „Jesam li ja vidljiv" — i zašto mora ovako
--
-- Pravilo je uzajamno: tuđe profile vidi samo onaj ko je i sam vidljiv. Da bi
-- politika to proverila, mora da pročita ISTU tabelu iz svoje `using` klauzule
-- — a Postgres na taj upit primeni RLS ponovo, pa politika pozove samu sebe:
--
--     ERROR: infinite recursion detected in policy for relation
--            "zajednica_profil"
--
-- Nije upozorenje: tabela postane potpuno nečitljiva. `security definer`
-- funkcija čita zaobilazeći RLS i prekida krug. Ne izlaže ništa — vraća jedan
-- boolean o POZIVAOCU, i to samo o njemu, jer `auth.uid()` ne prima argument.
-- ---------------------------------------------------------------------
create or replace function public.zajednica_vidljiv_ja()
returns boolean
language sql
stable
security definer
set search_path = public          -- bez ovoga je `security definer` funkcija
                                  -- ranjiva na podmetnutu šemu u search_path-u
as $$
  select coalesce(
    (select p.vidljiv from public.zajednica_profil p where p.user_id = auth.uid()),
    false)
$$;

comment on function public.zajednica_vidljiv_ja() is
  'Da li je POZIVALAC uključio Zajednicu. Postoji da bi politika izbegla beskonačnu rekurziju nad sopstvenom tabelom.';


-- ---------------------------------------------------------------------
-- 3. RLS
--
-- Svoj red čitaš i menjaš uvek — inače prekidač u Podešavanjima ne bi mogao
-- ni da se isključi kad jednom postaneš nevidljiv.
-- ---------------------------------------------------------------------
alter table public.zajednica_profil enable row level security;

drop policy if exists zajednica_profil_citaj  on public.zajednica_profil;
drop policy if exists zajednica_profil_pisi   on public.zajednica_profil;
drop policy if exists zajednica_profil_menjaj on public.zajednica_profil;
drop policy if exists zajednica_profil_brisi  on public.zajednica_profil;

create policy zajednica_profil_citaj on public.zajednica_profil for select
  using (auth.uid() = user_id or (vidljiv and public.zajednica_vidljiv_ja()));

-- `with check` na oba upisna puta: bez njega bi se u tuđe ime moglo UPISATI
-- (`using` gleda red PRE izmene, `with check` red POSLE).
create policy zajednica_profil_pisi on public.zajednica_profil for insert
  with check (auth.uid() = user_id);

create policy zajednica_profil_menjaj on public.zajednica_profil for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy zajednica_profil_brisi on public.zajednica_profil for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.zajednica_profil to authenticated;
-- Neprijavljen ne vidi Zajednicu uopšte. Bez ovog opoziva bi anon ključ — koji
-- stoji u izvornom kodu stranice, dakle kod svakoga — čitao ceo spisak.
revoke all on public.zajednica_profil from anon;


-- ---------------------------------------------------------------------
-- 4. `azurirano` postavlja baza, ne klijent
--
-- Vreme poslednje izmene je jedini podatak po kome se vidi da li je neko
-- prestao da koristi aplikaciju a ostao na spisku. Da ga upisuje aplikacija,
-- bio bi ono što ona kaže.
-- ---------------------------------------------------------------------
create or replace function public.zajednica_profil_dodirni()
returns trigger language plpgsql as $$
begin
  new.azurirano := now();
  return new;
end $$;

drop trigger if exists zajednica_profil_dodirni_trg on public.zajednica_profil;
create trigger zajednica_profil_dodirni_trg
  before insert or update on public.zajednica_profil
  for each row execute function public.zajednica_profil_dodirni();


-- ---------------------------------------------------------------------
-- 5. Izazov nedelje
--
-- JEDAN JEDINI RED, doveka. `check (id = 1)` to jemči iz baze: drugi red se
-- ne može ubaciti ni greškom ni namerno, pa aplikacija nikad ne mora da bira
-- „koji je pravi".
--
-- Čita ga svaki prijavljen korisnik. MENJA GA NIKO — nema nijedne politike za
-- insert/update/delete, pa RLS odbija sve. Vlasnik ga menja kroz
-- /api/broadcast {admin:'izazov'}, service_role ključem koji zaobilazi RLS i
-- postoji samo u Vercel okruženju. Ista kapija kao `lista`, `obrisi` i `ban`:
-- samo vlasnik, nikad CRON_SECRET, neovlašćen dobija 404 a ne 403.
-- ---------------------------------------------------------------------
create table if not exists public.zajednica_izazov (
  id        smallint primary key default 1 check (id = 1),
  tekst     text not null check (char_length(btrim(tekst)) between 3 and 160),
  azurirano timestamptz not null default now()
);

comment on table public.zajednica_izazov is
  'Izazov nedelje, jedan red. Menja ga isključivo vlasnik kroz /api/broadcast {admin:izazov}.';

insert into public.zajednica_izazov (id, tekst)
  values (1, 'Odradi sve treninge po planu ove nedelje.')
  on conflict (id) do nothing;   -- ne gazi tekst koji si već postavio

alter table public.zajednica_izazov enable row level security;

drop policy if exists zajednica_izazov_citaj on public.zajednica_izazov;
create policy zajednica_izazov_citaj on public.zajednica_izazov for select using (true);

grant select on public.zajednica_izazov to authenticated;
revoke all on public.zajednica_izazov from anon;


-- =====================================================================
-- POSLE PUŠTANJA
-- Pusti i supabase/provera.sql — ona sada proverava i ove objekte, pa se
-- odmah vidi da li je nešto preskočeno.
--
-- AKO PUKNE: „infinite recursion detected in policy"
-- Znači da je tačka 2 preskočena a tačka 3 prošla. Pusti fajl ponovo, ceo.
--
-- AKO PUKNE: „permission denied for table zajednica_profil"
-- Znači da je `grant` iz tačke 3 preskočen. Isto rešenje.
--
-- KAKO SE MENJA IZAZOV, bez SQL-a: Podešavanja → Zajednica → Izazov nedelje.
-- Vidljivo je samo tebi.
-- =====================================================================
