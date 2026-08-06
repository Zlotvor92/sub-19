-- =====================================================================
-- SUB-20 — PROVERA DA LI SE BAZA RAZIŠLA SA REPOZITORIJUMOM
--
-- ZAŠTO POSTOJI
-- Šema živi na dva mesta koja se puštaju odvojeno: SQL fajlovi idu rukom kroz
-- Supabase → SQL Editor, kod ide deployem. Kad se raziđu, ništa ne pukne
-- odmah — limit tiho prestane da broji, okidač koji je trebalo da zatvori
-- napad ne postoji, brojač reset uje dan u pogrešnoj vremenskoj zoni. Sve to
-- izgleda isto kao da radi.
--
-- Ovo je jedini način da se to vidi bez pogađanja. Pusti kad god posumnjaš, i
-- obavezno posle svakog puštanja nekog od fajlova u ovom folderu.
--
-- BEZBEDNO JE: čita ISKLJUČIVO katalog (pg_proc, pg_trigger, pg_class,
-- pg_policies). Nijedan red korisničkih podataka ne izlazi iz baze, pa se
-- ispis sme podeliti s kim god pomaže oko koda.
--
-- KAKO SE ČITA
-- Kolona `nalaz` je jedina koja je bitna:
--   OK        — na mestu je
--   NEDOSTAJE — objekat ne postoji; pusti odgovarajući fajl
--   STARO     — postoji, ali je starija verzija; pusti fajl ponovo
-- =====================================================================

with ocekivano_def as (
  -- Funkcije koje MORAJU biti `security definer`, jer pišu u tabele nad kojima
  -- pozivalac nema prava (brojači) ili moraju da rade u ime vlasnika.
  select unnest(array['ai_posao_nov','check_and_bump_api_usage',
                      'check_and_bump_bug_usage','check_and_bump_endpoint']) as ime
),
ocekivano_obicno as (
  -- Funkcije koje NE TREBA da budu `security definer`. Okidači `dodirni` i
  -- `prelaz` samo čitaju OLD/NEW i bacaju izuzetak — ne diraju nijednu drugu
  -- tabelu, pa im povišena prava ne trebaju.
  -- VAŽNO, da ne bude zabune: `security definer` određuje ČIJIM PRAVIMA se telo
  -- izvršava, a NE da li se okidač uopšte pali. Okidač se pali za svaku izmenu
  -- bez obzira ko je radi, i korisnik ga ne može isključiti (`ALTER TABLE …
  -- DISABLE TRIGGER` traži vlasništvo nad tabelom).
  select unnest(array['ai_posao_dodirni','ai_posao_prelaz']) as ime
)

-- 1. OKIDAČI nad ai_posao — bez njih se dnevni limit zaobilazi
select 'okidač · ' || o.ime as stavka,
       coalesce(case when t.tgenabled = 'O' then 'aktivan' else 'isključen' end, '—') as stanje,
       case when t.tgname is null then 'NEDOSTAJE — pusti ai-posao.sql'
            when t.tgenabled <> 'O' then 'STARO — okidač je isključen'
            else 'OK' end as nalaz
  from (select unnest(array['ai_posao_nov_trg','ai_posao_prelaz_trg','ai_posao_dodirni_trg']) as ime) o
  left join pg_trigger t
    on t.tgname = o.ime and t.tgrelid = to_regclass('public.ai_posao') and not t.tgisinternal

union all

-- 2. TABELE i RLS
select 'tabela · ' || o.ime,
       coalesce(case when c.relrowsecurity then 'RLS uključen' else 'RLS ISKLJUČEN' end, '—'),
       case when c.relname is null then 'NEDOSTAJE'
            when not c.relrowsecurity then 'STARO — RLS nije uključen'
            else 'OK' end
  from (select unnest(array['ai_posao','api_usage','bug_report_usage',
                            'endpoint_usage','push_pretplata','user_state']) as ime) o
  left join pg_class c on c.oid = to_regclass('public.' || o.ime)

union all

-- 3. FUNKCIJE — postojanje I ispravan bezbednosni kontekst
select 'funkcija · ' || o.ime,
       coalesce(case when p.prosecdef then 'security definer' else 'obična' end, '—'),
       case when p.proname is null then 'NEDOSTAJE'
            when not p.prosecdef then 'STARO — mora biti security definer'
            else 'OK' end
  from ocekivano_def o
  left join pg_proc p on p.proname = o.ime
   and p.pronamespace = 'public'::regnamespace

union all

select 'funkcija · ' || o.ime,
       coalesce(case when p.prosecdef then 'security definer (nepotrebno)' else 'obična' end, '—'),
       case when p.proname is null then 'NEDOSTAJE' else 'OK' end
  from ocekivano_obicno o
  left join pg_proc p on p.proname = o.ime
   and p.pronamespace = 'public'::regnamespace

union all

-- 4. VERZIJE — objekat postoji, ali je li tekući?
select 'verzija · ai_posao_nov hvata i nedostajuću tabelu',
       case when p.prosrc like '%undefined_table%' then 'da' else 'ne' end,
       case when p.proname is null then 'NEDOSTAJE'
            when p.prosrc like '%undefined_table%' then 'OK'
            else 'STARO — pusti ai-posao.sql ponovo' end
  from pg_proc p where p.proname = 'ai_posao_nov' and p.pronamespace = 'public'::regnamespace

union all

select 'verzija · ' || p.proname || ' računa dan po',
       case when p.prosrc like '%Europe/Belgrade%' then 'Beogradu' else 'UTC' end,
       case when p.prosrc like '%Europe/Belgrade%' then 'OK'
            else 'STARO — brojač se resetuje u 02:00 po lokalnom vremenu' end
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and p.proname in ('check_and_bump_api_usage','check_and_bump_bug_usage','check_and_bump_endpoint')

union all

-- 5. POLITIKE nad ai_posao — RLS bez politike ne pušta nikoga,
--    a pogrešna politika pušta svakoga.
select 'politika · ai_posao.' || polname, cmd, 'OK'
  from pg_policies where schemaname = 'public' and tablename = 'ai_posao'

order by 1;

-- =====================================================================
-- ŠTA URADITI SA NALAZOM
--
--   sve OK                        -> baza i repozitorijum se poklapaju
--   NEDOSTAJE kod ai_posao_*      -> pusti supabase/ai-posao.sql
--   NEDOSTAJE kod api_usage       -> pusti supabase/api-usage.sql
--   NEDOSTAJE kod endpoint_usage  -> pusti supabase/rate-limit.sql
--   STARO                         -> pusti taj isti fajl ponovo, ceo
--
-- Puštanje bilo kog od tih fajlova dvaput je bezbedno.
-- =====================================================================
