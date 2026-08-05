-- =====================================================================
-- SUB-20 — AI analiza ODVOJENA OD ČEKANJA
--
-- ŠTA REŠAVA
-- Analiza je do sada išla u jednom zahtevu: klik → čekaj → tekst. Taj zahtev
-- živi najduže koliko i Vercel funkcija (maxDuration, 60 s), pa je svaki
-- sporiji odgovor modela završavao kao HTTP 504 — analiza je možda i bila
-- napravljena, ali je nestala jer nije imala gde da se upiše. Isto se dešavalo
-- i kad telefon uspava stranicu dok se čeka: iOS prekine vezu, rezultat propada.
--
-- Sada posao ima svoj red u bazi. Klijent ga pokrene, ne čeka ga, i pokupi
-- rezultat kad god se vrati — makar i sutra. Tekst se ne gubi ni ako se
-- aplikacija zatvori usred računanja.
--
-- KAKO SE PUŠTA
-- Supabase → SQL Editor → nalepi CEO ovaj fajl → Run. Traje sekund.
-- Puštanje dvaput je bezbedno (sve je `if not exists` / `create or replace`).
--
-- ŠTA NE DIRA
-- `endpoint_usage`, `api_usage` i `bug_report_usage` ostaju netaknute.
-- Dnevni limit analiza se i dalje broji kroz `check_and_bump_api_usage`, i to
-- SAMO pri pokretanju posla — ne pri čitanju rezultata.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------------------
create table if not exists public.ai_posao (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  stanje     text        not null default 'radi',   -- radi | u_toku | gotovo | greska
  tekst      text,
  greska     text,
  napravljen timestamptz not null default now(),
  izmenjen   timestamptz not null default now()
);

comment on table public.ai_posao is
  'Jedna AI analiza u obradi. Klijent pokrene posao, ne čeka ga, i kasnije pročita rezultat.';

-- Čišćenje starih poslova ide po ovom indeksu (v. tačku 4).
create index if not exists ai_posao_stari_idx on public.ai_posao (user_id, napravljen);

-- ---------------------------------------------------------------------
-- 2. RLS — svako vidi i menja ISKLJUČIVO svoje poslove
--
-- Server ne koristi service_role ključ za ovu tabelu nego korisnikov token,
-- isto kao za brojače. Tako baza, a ne kod, jemči da tuđi rezultat ne može
-- da se pročita — i kad bi se u kodu jednom promašio filter.
-- ---------------------------------------------------------------------
alter table public.ai_posao enable row level security;

drop policy if exists ai_posao_citaj  on public.ai_posao;
drop policy if exists ai_posao_pisi   on public.ai_posao;
drop policy if exists ai_posao_menjaj on public.ai_posao;
drop policy if exists ai_posao_brisi  on public.ai_posao;

create policy ai_posao_citaj  on public.ai_posao for select using (auth.uid() = user_id);
create policy ai_posao_pisi   on public.ai_posao for insert with check (auth.uid() = user_id);
create policy ai_posao_menjaj on public.ai_posao for update using (auth.uid() = user_id)
                                                   with check (auth.uid() = user_id);
create policy ai_posao_brisi  on public.ai_posao for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.ai_posao to authenticated;

-- ---------------------------------------------------------------------
-- 3. Automatsko `izmenjen`
-- ---------------------------------------------------------------------
create or replace function public.ai_posao_dodirni()
returns trigger language plpgsql as $$
begin
  new.izmenjen := now();
  return new;
end $$;

drop trigger if exists ai_posao_dodirni_trg on public.ai_posao;
create trigger ai_posao_dodirni_trg
  before update on public.ai_posao
  for each row execute function public.ai_posao_dodirni();

-- ---------------------------------------------------------------------
-- 4. Čišćenje
--
-- Red je potreban samo dok se rezultat ne pokupi. Sam tekst već živi na
-- uređaju i u backupu, pa ovde nema šta da se čuva „za svaki slučaj" —
-- gomilanje bi bilo čist trošak. Briše ga sam server pri pokretanju sledećeg
-- posla (poslovi stariji od jednog dana), pa ovde nije potreban ni cron.
-- ---------------------------------------------------------------------

-- =====================================================================
-- AKO PUKNE: „permission denied for table ai_posao"
-- Znači da je `grant` iz tačke 2 preskočen — pusti fajl ponovo, ceo.
-- =====================================================================
