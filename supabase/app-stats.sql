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
-- je `'v'`. Popravljeno; ovaj fajl je druga polovina ispravke.
--
-- DEFINICIJA ISPOD JE PREPISANA IZ ŽIVE BAZE, ne rekonstruisana iz koda.
-- Izvor: `select pg_get_viewdef('public.app_stats', true);` (11. avgust 2026).
-- Prva verzija ovog fajla JESTE bila rekonstrukcija i razilazila se u tri
-- stvari — dve kolone manje i pogrešan izvor za `korisnika` i `novih_7d`.
-- Zato pravilo: kad se fajl i baza razilaze, BAZA JE MERODAVNA.
--
-- ŠTA SE DEŠAVA AKO POGLEDA NEMA
-- `fetchStats` baca, a handler je do sada na to radio `return 502` PRE poziva
-- `izvrsiOdlozenaBrisanja()` — pa se odložena brisanja naloga ne bi izvršila
-- nijedan dan, i to bez ijedne poruke ikome (izveštaj koji bi to javio je isti
-- onaj koji nije poslat). I to je popravljeno: statistika sada otkazuje kao
-- svaki drugi korak, u svom `try/catch`, i izveštaj ide dalje uz vidljiv
-- crveni okvir umesto šest nula.
--
-- PUŠTANJE JE BEZOPASNO: definicija je identična zatečenoj, pa `create or
-- replace` ništa ne menja. Fajl je zapis, ne migracija.
--
-- ---------------------------------------------------------------------
-- ZAVISI OD `user_state.created_at`
--
-- Ta kolona POSTOJI u bazi, ali je `supabase/user-state.sql` nije opisivao —
-- isto razilaženje kao i sam ovaj pogled, samo jedan sloj dublje. Nađeno tek
-- kad je definicija prepisana iz baze. Sada je dodata tamo
-- (`add column if not exists`), pa bi tabela napravljena iz repozitorijuma
-- imala sve što ovaj pogled traži. Bez toga bi `create or replace view` na
-- svežoj bazi pukao sa „column created_at does not exist" — a to je jedini
-- ishod koji se vidi odmah; gori je onaj u kom se ne vidi ništa.
-- ---------------------------------------------------------------------
--
-- DVE KOLONE KOJE NIKO NE ČITA
-- `prosek_treninga` i `prosek_vdot_unosa` se računaju, ali ih
-- `api/daily-report.js` nigde ne koristi (`buildHtml` čita šest kolona:
-- korisnika, aktivnih_24h/7d/30d, novih_7d, sa_generisanim_planom).
-- Ostavljene su NAMERNO, jer je ovaj fajl zapis zatečenog stanja, a ne prilika
-- da se ono menja. Ako se ikad brišu, to je zasebna odluka i zaseban commit —
-- `prosek_treninga` je i najskuplji deo upita (korelisan podupit po svakom
-- redu), pa bi brisanje bilo i ubrzanje.
--
-- ŠTA `korisnika` ZAPRAVO BROJI
-- Redove u `user_state`, ne naloge u `auth.users` — dakle ljude koji su bar
-- jednom sinhronizovali stanje. Isto važi za `novih_7d`. Nalog koji je
-- napravljen pa nikad ništa nije upisao se ovde ne broji. To je zatečeno
-- ponašanje i namerno se ne dira; zapisano je da naslov „Korisnika ukupno" u
-- mejlu ne bi obećavao više nego što meri.
-- =====================================================================

create or replace view public.app_stats as
select
  count(*)                                                                as korisnika,
  count(*) filter (where updated_at > now() - '24:00:00'::interval)       as aktivnih_24h,
  count(*) filter (where updated_at > now() - '7 days'::interval)         as aktivnih_7d,
  count(*) filter (where updated_at > now() - '30 days'::interval)        as aktivnih_30d,
  count(*) filter (where created_at > now() - '7 days'::interval)         as novih_7d,
  round(avg((
    select count(*)
      from jsonb_object_keys(coalesce(user_state.data -> 'log', '{}'::jsonb))
  )))                                                                     as prosek_treninga,
  round(avg(jsonb_array_length(coalesce(data -> 'vdotLog', '[]'::jsonb)))) as prosek_vdot_unosa,
  count(*) filter (
    where (data -> 'genPlan') is not null and (data -> 'genPlan') <> 'null'::jsonb
  )                                                                       as sa_generisanim_planom
from public.user_state;

comment on view public.app_stats is
  'Agregatni brojevi za dnevni izveštaj vlasniku. Čita ISKLJUČIVO api/daily-report.js, service_role ključem.';

-- ---------------------------------------------------------------------
-- DOZVOLE
-- ---------------------------------------------------------------------
-- Pogled sabira SVE redove `user_state`, dakle preko granice koju RLS inače
-- drži za svakog korisnika ponaosob. Zato ga ne sme videti niko osim
-- `service_role` — a on RLS i inače zaobilazi, pa mu poseban `grant` ne treba.
--
-- `revoke ... from public` ide prvo: Postgres novim objektima podrazumevano
-- daje pravo čitanja svima. Bez ovoga bi jedan prijavljen korisnik kroz
-- PostgREST mogao da pročita koliko aplikacija ima korisnika i koliko ih je
-- aktivno — nije tuđ red, ali nije ni njegov posao.
--
-- Ovaj deo je bezopasan i nezavisan od definicije iznad: ništa osim dnevnog
-- izveštaja ne čita ovaj pogled, pa se oduzimanjem prava ne može ništa
-- pokvariti. Sme se pustiti i sam.
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
--
-- I da se fajl i baza i dalje slažu:
--
--   select pg_get_viewdef('public.app_stats', true);
--
-- Ako se razlikuje od definicije iznad — baza je merodavna, prepiši fajl.
-- =====================================================================
