-- =====================================================================
-- SUB-20 — `app_stats`: agregatni brojevi za vrh dnevnog izveštaja
--
-- ZAŠTO OVAJ FAJL POSTOJI (a nije postojao)
-- `api/daily-report.js` čita `/rest/v1/app_stats?select=*` od prvog dana, ali
-- taj pogled nije bio ni u jednom fajlu u `supabase/`. Napravljen je rukom u
-- SQL Editoru i ostao samo tamo — dakle tačno ono stanje koje
-- `supabase/podesavanja.md` opisuje kao pouku prethodnog čišćenja: „ono što
-- nije u repozitorijumu postaje nevidljivo". `user_state` je isto tako nestala
-- iz vidokruga.
--
-- `inventar.sql` je pisan da to više ne bude moguće, ali ovo mu je izmicalo:
-- gledao je `relkind in ('r','p')` — obične i particionisane tabele — a pogled
-- je `'v'`. Popravljeno u istom commitu; ovaj fajl je druga polovina ispravke.
--
-- ŠTA SE DEŠAVA AKO GA NEMA
-- `fetchStats` baca, a handler je do sada na to radio `return 502` PRE poziva
-- `izvrsiOdlozenaBrisanja()` — pa se odložena brisanja naloga ne bi izvršila
-- nijedan dan, i to bez ijedne poruke ikome (izveštaj koji bi to javio je isti
-- onaj koji nije poslat). I to je popravljeno u istom commitu: statistika sada
-- otkazuje kao svaki drugi korak, u svom `try/catch`, i izveštaj ide dalje.
--
-- ---------------------------------------------------------------------
-- ⚠ PRE PUŠTANJA — OVA DEFINICIJA JE REKONSTRUISANA IZ KODA, NE IZ BAZE.
--
-- Izvedena je iz kolona koje `api/daily-report.js` stvarno čita (`buildHtml`):
-- korisnika, aktivnih_24h, aktivnih_7d, aktivnih_30d, novih_7d,
-- sa_generisanim_planom. Ako je pogled u bazi definisan drugačije, `create or
-- replace` bi promenio brojeve u izveštaju.
--
-- Zato PRVO pusti ovo, u zasebnom pokretanju, i uporedi:
--
--   select pg_get_viewdef('public.app_stats', true);
--
-- Ako se poklapa — nemaš šta da radiš, fajl je samo zapis. Ako se razlikuje,
-- prepiši zatečenu definiciju OVDE (ona je merodavna, ne ova) pa tek onda
-- commit. Nemoj pustiti ovaj fajl „da bude sigurno".
-- ---------------------------------------------------------------------
--
-- ZAŠTO POGLED, A NE ŠEST UPITA IZ KODA
-- Jedan mrežni krug umesto šest, i brojanje ostaje u bazi — funkcija ne mora
-- da povlači redove da bi ih prebrojala. Nijedan red podataka ne izlazi iz
-- pogleda, samo brojevi.
-- =====================================================================

create or replace view public.app_stats as
select
  (select count(*) from auth.users)                         as korisnika,
  (select count(*) from public.user_state
     where updated_at > now() - interval '24 hours')         as aktivnih_24h,
  (select count(*) from public.user_state
     where updated_at > now() - interval '7 days')           as aktivnih_7d,
  (select count(*) from public.user_state
     where updated_at > now() - interval '30 days')          as aktivnih_30d,
  (select count(*) from auth.users
     where created_at > now() - interval '7 days')           as novih_7d,
  (select count(*) from public.user_state
     where data -> 'genPlan' is not null
       and data -> 'genPlan' <> 'null'::jsonb)               as sa_generisanim_planom;

comment on view public.app_stats is
  'Agregatni brojevi za dnevni izveštaj vlasniku. Čita ISKLJUČIVO api/daily-report.js, service_role ključem.';

-- ---------------------------------------------------------------------
-- DOZVOLE
-- ---------------------------------------------------------------------
-- Pogled čita `auth.users` i sve redove `user_state`, dakle preko granice koju
-- RLS inače drži. Zato ga ne sme videti niko osim `service_role` — a on RLS i
-- inače zaobilazi, pa mu poseban `grant` ne treba.
--
-- `revoke ... from public` ide prvo: Postgres novim objektima podrazumevano
-- daje pravo čitanja svima. Bez ovoga bi jedan prijavljen korisnik kroz
-- PostgREST mogao da pročita koliko aplikacija ima korisnika — nije tuđ red,
-- ali nije ni njegov posao.
revoke all on public.app_stats from public;
revoke all on public.app_stats from anon, authenticated;

-- =====================================================================
-- PROVERA DA JE PUŠTENO
--
--   select to_regclass('public.app_stats') as pogled;
--
-- Popunjeno = na mestu. Prazno = nije pušteno.
--
-- I da ga niko sa strane ne vidi:
--
--   select grantee, privilege_type
--     from information_schema.role_table_grants
--    where table_schema='public' and table_name='app_stats';
--
-- Ne sme biti reda sa `anon` ni `authenticated`.
-- =====================================================================
