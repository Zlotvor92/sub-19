-- =====================================================================
-- SUB-20 — public.user_state
--
-- ZAŠTO OVAJ FAJL POSTOJI TEK SADA
-- Ova tabela nosi CELO stanje korisnika: plan, dnevnik treninga, beleške,
-- HRV, puls u miru, san, težinu, mapu bolova, istoriju forme. Nastala je
-- rukom kroz Supabase → SQL Editor, pre nego što je ovaj folder uopšte
-- postojao — pa je bila jedina tabela čije politike NISU bile ni u jednom
-- fajlu u repozitorijumu. Posledica nije bila rupa nego NEVIDLJIVOST: nije
-- postojalo ništa sa čim bi se stvarne politike uporedile, i `provera.sql`
-- ju je zato mogao samo da prijavi kao „RLS uključen · OK" — i za politiku
-- `using (auth.uid() = user_id)` i za politiku `using (true)`.
--
-- OVO JE IDEMPOTENTNO I NAMERNO NE DIRA PODATKE.
-- `create table if not exists` neće prepisati zatečenu tabelu; kolone se
-- dodaju samo ako ih nema. Politike se pišu iznova (`drop policy if exists`
-- pa `create policy`) — to je i svrha: da izraz u bazi bude tačno onaj koji
-- stoji ovde, a ne onaj koji se u nekom trenutku zatekao.
--
-- PRE PUŠTANJA SNIMI ZATEČENO STANJE, da postoji čemu da se vratiš:
--   select policyname, cmd, qual, with_check
--     from pg_policies where schemaname='public' and tablename='user_state';
--
-- Posle puštanja obavezno `provera.sql`.
-- =====================================================================

-- 1. TABELA
-- Oblik je izveden iz onoga što kod stvarno šalje i čita:
--   upis   (app.js, sbPush)  user_id, data, device_id, app_version
--   čitanje(app.js, sbPull)  data, updated_at
--   čitanje(app.js, sbRemoteAt) updated_at, device_id
--   čitanje(api/daily-report) user_id, data, updated_at   (service_role)
create table if not exists public.user_state (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  data        jsonb       not null default '{}'::jsonb,
  device_id   text,
  app_version text,
  updated_at  timestamptz not null default now()
);

-- Kolone koje su dodate kasnije — na zatečenoj tabeli ih možda nema.
alter table public.user_state add column if not exists device_id   text;
alter table public.user_state add column if not exists app_version text;
alter table public.user_state add column if not exists updated_at  timestamptz not null default now();

comment on table public.user_state is
  'Celo stanje jednog korisnika, jedan red po nalogu. Prepisuje se u mestu; prethodne verzije čuva user_state_istorija (v. istorija.sql).';

-- 2. `updated_at` MORA da postavlja baza, ne klijent.
-- `sbRemoteAt` po njemu odlučuje čija je kopija novija i time koja izmena
-- preživljava. Da ga šalje klijent, uređaj sa satom u budućnosti bi zauvek
-- „pobeđivao" i tiho gazio izmene sa svih ostalih uređaja.
create or replace function public.user_state_touch()
returns trigger language plpgsql as $$
begin
  NEW.updated_at := now();
  return NEW;
end $$;

drop trigger if exists user_state_touch_trg on public.user_state;
create trigger user_state_touch_trg
  before insert or update on public.user_state
  for each row execute function public.user_state_touch();

-- 3. RLS
alter table public.user_state enable row level security;

-- `anon` nema šta da traži ovde. RLS štiti redove, ali `grant` je sloj ispod
-- njega: bez ovoga javni anon ključ dobija pristup tabeli i sve visi na tome
-- da je politika napisana ispravno.
revoke all on table public.user_state from anon;
grant select, insert, update, delete on table public.user_state to authenticated;

-- SVAKA politika veže red za `auth.uid()`. Nema nijednog izuzetka: za razliku
-- od `zajednica_profil`, ovde ne postoji ništa što bi drugi smeo da vidi.
drop policy if exists user_state_citaj on public.user_state;
create policy user_state_citaj on public.user_state
  for select using (auth.uid() = user_id);

drop policy if exists user_state_upisi on public.user_state;
create policy user_state_upisi on public.user_state
  for insert with check (auth.uid() = user_id);

-- `using` I `with check`: bez `with check` bi izmena mogla da prepiše
-- `user_id` na tuđi i time preda red drugome.
drop policy if exists user_state_azuriraj on public.user_state;
create policy user_state_azuriraj on public.user_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Brisanje sopstvenog reda je deo brisanja naloga (v. api/delete-account.js).
drop policy if exists user_state_obrisi on public.user_state;
create policy user_state_obrisi on public.user_state
  for delete using (auth.uid() = user_id);

-- 4. PROVERA ODMAH POSLE PUŠTANJA
-- Očekivano: četiri politike, svaka sa `auth.uid()` u izrazu, i nijedan red
-- za `anon`.
--   select policyname, cmd, qual, with_check
--     from pg_policies where schemaname='public' and tablename='user_state'
--    order by cmd;
--   select grantee, privilege_type from information_schema.role_table_grants
--    where table_schema='public' and table_name='user_state' and grantee='anon';
