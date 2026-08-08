-- =====================================================================
-- SUB-20 — ADMINISTRATORSKO BRISANJE SA ODLOŽENIM IZVRŠENJEM
--
-- ŠTA REŠAVA
-- Do sada je `/api/broadcast {admin:'obrisi'}` brisao tuđ nalog i sve njegove
-- podatke ODMAH i NEPOVRATNO — jednim HTTP pozivom. Ko preuzme vlasnikov
-- Google nalog, tim jednim pozivom u petlji briše sve korisnike, i ne postoji
-- ništa što bi to vratilo.
--
-- Sada se nalog OZNAČI i ZABRANI. Pristup prestaje u istom trenutku, dakle
-- svrha brisanja je ispunjena odmah, ali se podaci stvarno uklanjaju tek posle
-- roka. Do isteka roka se sve može poništiti jednim dugmetom.
--
-- ZAŠTO 7 DANA
-- Dovoljno da se primeti i vrati (uz obaveštenje na mejl koje stiže odmah),
-- a znatno kraće od 30 dana koje politika privatnosti navodi kao rok u kom se
-- podaci brišu. Dakle usklađeno i sa obećanjem korisniku.
--
-- ŠTA OVO NE MENJA
-- `/api/delete-account` — kad korisnik SAM obriše svoj nalog — ostaje trenutno
-- i nepovratno. Tu nema napadača od koga se brani: čovek je otkucao potvrdu za
-- svoje podatke, i odlaganje bi bilo kršenje onoga što mu je obećano.
--
-- KAKO SE PUŠTA
-- Supabase → SQL Editor → nalepi CEO ovaj fajl → Run.
-- Puštanje dvaput je bezbedno.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tabela
--
-- `email` se pamti NAMERNO, iako je već u auth.users: kad rok istekne i nalog
-- nestane, u obaveštenju i logu mora da ostane zapis ČIJI je nalog uklonjen.
-- Bez toga ostaje samo identifikator koji više ništa ne pokazuje.
-- ---------------------------------------------------------------------
create table if not exists public.nalog_za_brisanje (
  user_id      uuid        primary key references auth.users(id) on delete cascade,
  email        text,
  oznacio      text        not null,
  oznaceno     timestamptz not null default now(),
  izvrsi_posle timestamptz not null
);

comment on table public.nalog_za_brisanje is
  'Nalozi koje je vlasnik označio za brisanje. Pristup im je već zabranjen; podaci se uklanjaju tek posle izvrsi_posle. Dira ISKLJUČIVO service_role.';

-- Jutarnji posao traži samo one kojima je rok istekao.
create index if not exists nalog_za_brisanje_rok_idx
  on public.nalog_za_brisanje (izvrsi_posle);


-- ---------------------------------------------------------------------
-- 2. NIKO OSIM SERVERA
--
-- RLS je uključen a politika NEMA NIJEDNE — dakle ni `anon` ni `authenticated`
-- ne mogu ništa, ni da pročitaju. Radi se isključivo service_role ključem, koji
-- postoji samo u Vercel okruženju.
--
-- Zašto ni čitanje: spisak naloga označenih za brisanje je spisak tuđih
-- e-adresa. To je isti podatak koji `admin:'lista'` čuva iza vlasnikove kapije
-- i nema razloga da bude dostupniji.
-- ---------------------------------------------------------------------
alter table public.nalog_za_brisanje enable row level security;

revoke all on public.nalog_za_brisanje from anon;
revoke all on public.nalog_za_brisanje from authenticated;


-- =====================================================================
-- POSLE PUŠTANJA
--
-- 1. U Vercel → Settings → Environment Variables dodaj ADMIN_2FA — lozinku
--    koju ćeš kucati u aplikaciji za razorne radnje. Dok je nema, brisanje i
--    zabrana se ODBIJAJU (namerno: bezbednosna provera koja se sama isključi
--    kad nije podešena ne štiti ni od čega).
--
-- 2. Pusti supabase/provera.sql — proverava i ove objekte.
--
-- ROK ISTIČE: jutarnji posao (/api/daily-report, 05:00) briše sve kojima je
-- `izvrsi_posle` prošao, i tek tada nestaju podaci i sam nalog.
-- =====================================================================
