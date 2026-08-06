-- =====================================================================
-- SUB-20 — OBAVEŠTENJA (Web Push)
--
-- ŠTA ČUVA
-- Jedan red = jedan uređaj koji je pristao na obaveštenja. `endpoint` je
-- adresa koju izda push servis pregledača (Google/Apple/Mozilla), a `p256dh`
-- i `auth` su ključevi kojima se sadržaj šifruje ZA TAJ uređaj. Bez njih
-- server ne može da pošalje ništa — a sa njima ne može da pročita ono što je
-- poslao, jer se šifruje ključem koji postoji samo na uređaju.
--
-- `najave` je mala mapa datum -> tekst za narednih nedelju dana, npr.
--   { "2026-08-07": "8×400 m + 2 km lako", "2026-08-08": "" }
-- Aplikacija je upiše pri otvaranju; jutarnji cron samo izvadi današnji dan.
-- Prazan tekst znači dan odmora — tada se ne šalje ništa. Tako plan ostaje
-- SAMO u aplikaciji: server ne zna ništa o VDOT-u, tempu ni tipovima sesija
-- i ne može da se raziđe sa njom.
--
-- KAKO SE PUŠTA
-- Supabase → SQL Editor → nalepi CEO ovaj fajl → Run. Traje sekund.
-- Puštanje dvaput je bezbedno (sve je `if not exists` / `create or replace`).
--
-- ŠTA NE DIRA
-- `user_state`, `ai_posao`, `api_usage`, `endpoint_usage` ostaju netaknute.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------------------
create table if not exists public.push_pretplata (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  -- JEDINSTVEN: pregledač izdaje jedan endpoint po instalaciji aplikacije.
  -- Bez ovoga bi svako otvaranje aplikacije pravilo nov red i isti telefon
  -- bi dobijao isto obaveštenje pet puta.
  endpoint    text        not null unique,
  p256dh      text        not null,
  auth        text        not null,
  uredjaj     text,                                  -- device_id iz aplikacije, samo za snalaženje
  najave      jsonb       not null default '{}'::jsonb,
  napravljena timestamptz not null default now(),
  izmenjena   timestamptz not null default now()
);

comment on table public.push_pretplata is
  'Jedan uređaj prijavljen za obaveštenja. Sadržaj se šifruje ključevima iz ovog reda.';

-- Cron čita sve redove redom (paginirano po id-u), a slanje jednom korisniku
-- filtrira po user_id — oba puta se koristi indeks.
create index if not exists push_pretplata_korisnik_idx on public.push_pretplata (user_id);

-- ---------------------------------------------------------------------
-- 2. RLS — svako vidi i menja ISKLJUČIVO svoje uređaje
--
-- Prijava i odjava iz aplikacije idu KORISNIKOVIM tokenom, pa baza (a ne naš
-- kod) jemči da se tuđa pretplata ne može ni pročitati ni obrisati. Jedino
-- jutarnji cron i „analiza je gotova" koriste service_role — njima korisnikov
-- token ne postoji jer korisnik tada nije prisutan.
--
-- Zašto je to bezbedno: service_role ključ postoji SAMO u Vercel okruženju,
-- nikad u aplikaciji. Isti dogovor važi za daily-report.
-- ---------------------------------------------------------------------
alter table public.push_pretplata enable row level security;

drop policy if exists push_pretplata_citaj  on public.push_pretplata;
drop policy if exists push_pretplata_pisi   on public.push_pretplata;
drop policy if exists push_pretplata_menjaj on public.push_pretplata;
drop policy if exists push_pretplata_brisi  on public.push_pretplata;

create policy push_pretplata_citaj  on public.push_pretplata for select using (auth.uid() = user_id);
create policy push_pretplata_pisi   on public.push_pretplata for insert with check (auth.uid() = user_id);
create policy push_pretplata_menjaj on public.push_pretplata for update using (auth.uid() = user_id)
                                                              with check (auth.uid() = user_id);
create policy push_pretplata_brisi  on public.push_pretplata for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.push_pretplata to authenticated;

-- ---------------------------------------------------------------------
-- 3. Automatsko `izmenjena`
-- ---------------------------------------------------------------------
create or replace function public.push_pretplata_dodirni()
returns trigger language plpgsql as $$
begin
  new.izmenjena := now();
  return new;
end $$;

drop trigger if exists push_pretplata_dodirni_trg on public.push_pretplata;
create trigger push_pretplata_dodirni_trg
  before update on public.push_pretplata
  for each row execute function public.push_pretplata_dodirni();

-- =====================================================================
-- POSLE OVOGA, u Vercel → Settings → Environment Variables dodaj:
--   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
-- Ključeve pravi `node scripts/vapid.mjs` (v. taj fajl).
--
-- AKO PUKNE: „permission denied for table push_pretplata"
-- Znači da je `grant` iz tačke 2 preskočen — pusti fajl ponovo, ceo.
-- =====================================================================
