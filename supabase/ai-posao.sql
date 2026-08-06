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
-- 3a. STANJE POSLA JE SERVEROV AUTOMAT, NE KORISNIKOV PODATAK
--
-- ŠTA JE BILA RUPA
-- RLS iz tačke 2 dozvoljava korisniku da menja SVOJ red — a to znači i
-- kolonu `stanje`. Anon ključ stoji u app.js (javan je po dizajnu), korisnik
-- ima svoj JWT, dakle nedostaje mu samo jedan poziv:
--
--   PATCH /rest/v1/ai_posao?id=eq.<svoj posao>   {"stanje":"radi"}
--
-- Posle njega `posaoPreuzmi()` u /api/analyze.js opet nađe red u stanju
-- 'radi', pozove model — i ne pomeri dnevni brojač, jer se faza 'radi' broji
-- kao nastavak već izbrojanog posla. Petlja. Jedna izbrojana analiza time
-- otključava neograničeno mnogo neizbrojanih.
--
-- Druga polovina iste rupe: `insert` politika dozvoljava korisniku da red
-- napravi SAM, preko PostgREST-a, zaobilazeći /api/analyze i njegov brojač.
--
-- KAKO SE ZATVARA
-- Ne ukidanjem politika (server namerno radi korisnikovim tokenom, ne
-- service_role ključem — v. tačku 2), nego time što baza sama pazi na
-- prelaze. Dozvoljeno je tačno ono što server radi:
--     radi   -> u_toku
--     u_toku -> gotovo | greska
-- Sve ostalo, a naročito BILO ŠTA -> 'radi', se odbija. Vlasnik reda se ne
-- može promeniti ni greškom ni namerno.
-- ---------------------------------------------------------------------
create or replace function public.ai_posao_prelaz()
returns trigger language plpgsql as $$
begin
  if new.user_id <> old.user_id then
    raise exception 'AI_POSAO_TUDJI' using errcode = '42501';
  end if;

  if new.stanje is distinct from old.stanje then
    -- Nazad na 'radi' ne vodi nijedan ispravan put. To je bio ceo napad.
    if new.stanje = 'radi' then
      raise exception 'AI_POSAO_PONOVO' using errcode = '22023';
    end if;
    if not (
      (old.stanje = 'radi'   and new.stanje = 'u_toku') or
      (old.stanje = 'u_toku' and new.stanje in ('gotovo', 'greska'))
    ) then
      raise exception 'AI_POSAO_PRELAZ' using errcode = '22023';
    end if;
  end if;

  return new;
end $$;

-- Ime počinje slovom iza `ai_posao_dodirni_trg`, pa se BEFORE okidači pale
-- baš tim redom: prvo se upiše `izmenjen`, pa se prelaz proveri.
drop trigger if exists ai_posao_prelaz_trg on public.ai_posao;
create trigger ai_posao_prelaz_trg
  before update on public.ai_posao
  for each row execute function public.ai_posao_prelaz();

-- ---------------------------------------------------------------------
-- 3b. NOV POSAO SE NE MOŽE NAPRAVITI MIMO BROJAČA
--
-- Red se uvek rađa u stanju 'radi' i uvek pripada onome ko ga pravi — šta god
-- da je pozivalac poslao. Uz to nosi GORNJU GRANICU po korisniku po danu,
-- nezavisnu od one u /api/analyze.js.
--
-- ZAŠTO DVA LIMITA: onaj u kodu (30) je pravi, tačan i ume da vrati razumljivu
-- poruku. Ovaj je mreža ispod njega — vezuje se za SAM RED, pa važi i kad se
-- red napravi direktno preko PostgREST-a, i kad se u kodu sutra pojavi nova
-- faza koja slučajno preskoči brojanje. Zato je i postavljen dvostruko više
-- (60): nikad ne sme da preduhitri poruku iz koda kod stvarnog korisnika,
-- samo da preseče skriptu.
--
-- Ako `check_and_bump_endpoint` još nije puštena (v. rate-limit.sql), mreža
-- se preskače umesto da obori analizu — limit u kodu je i dalje na mestu.
-- ---------------------------------------------------------------------
create or replace function public.ai_posao_nov()
returns trigger language plpgsql
security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null then
    new.user_id := auth.uid();
    begin
      perform public.check_and_bump_endpoint('ai_posao', 60);
    exception
      -- MREŽA KOJA NEDOSTAJE NE SME DA OBORI ANALIZU.
      -- Namera je: ako brojač iz rate-limit.sql nije dostupan, preskoči ga —
      -- pravi limit je u kodu (/api/analyze) i i dalje radi. Prva verzija je
      -- hvatala SAMO `undefined_function`, što je uže od te namere: da tabela
      -- `endpoint_usage` ikad nedostaje dok funkcija postoji, greška bi bila
      -- `undefined_table`, propala bi kroz handler i oborila UPIS POSLA —
      -- dakle celu AI analizu, i to tiho, tek kad neko klikne.
      -- DAILY_LIMIT_EXCEEDED (P0001) se NAMERNO ne hvata: to je backstop koji
      -- treba da radi. `when others` bi ga progutao i mreža ne bi postojala.
      when undefined_function or undefined_table or insufficient_privilege then null;
    end;
  end if;
  new.stanje := 'radi';
  new.tekst  := null;
  new.greska := null;
  return new;
end $$;

drop trigger if exists ai_posao_nov_trg on public.ai_posao;
create trigger ai_posao_nov_trg
  before insert on public.ai_posao
  for each row execute function public.ai_posao_nov();

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
