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
                      'check_and_bump_bug_usage','check_and_bump_endpoint',
                      -- Bez `security definer` ova puca sa „infinite recursion
                      -- detected in policy" i Zajednica postane nečitljiva.
                      'zajednica_vidljiv_ja','user_state_zapamti']) as ime
),
ocekivano_obicno as (
  -- Funkcije koje NE TREBA da budu `security definer`. Okidači `dodirni` i
  -- `prelaz` samo čitaju OLD/NEW i bacaju izuzetak — ne diraju nijednu drugu
  -- tabelu, pa im povišena prava ne trebaju.
  -- VAŽNO, da ne bude zabune: `security definer` određuje ČIJIM PRAVIMA se telo
  -- izvršava, a NE da li se okidač uopšte pali. Okidač se pali za svaku izmenu
  -- bez obzira ko je radi, i korisnik ga ne može isključiti (`ALTER TABLE …
  -- DISABLE TRIGGER` traži vlasništvo nad tabelom).
  select unnest(array['ai_posao_dodirni','ai_posao_prelaz',
                      'push_pretplata_dodirni','zajednica_profil_dodirni']) as ime
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

-- 1a. OKIDAČ nad user_state — bez njega nema istorije verzija, a to se ne vidi
--     dok ne zatreba. Isti oblik provere kao za ai_posao.
select 'okidač · user_state_zapamti_trg',
       coalesce(case when t.tgenabled = 'O' then 'aktivan' else 'isključen' end, '—'),
       case when t.tgname is null then 'NEDOSTAJE — pusti istorija.sql'
            when t.tgenabled <> 'O' then 'STARO — okidač je isključen'
            else 'OK' end
  from (select 1) x
  left join pg_trigger t
    on t.tgname = 'user_state_zapamti_trg' and t.tgrelid = to_regclass('public.user_state')
   and not t.tgisinternal

union all

-- 2. TABELE i RLS
select 'tabela · ' || o.ime,
       coalesce(case when c.relrowsecurity then 'RLS uključen' else 'RLS ISKLJUČEN' end, '—'),
       case when c.relname is null then 'NEDOSTAJE'
            when not c.relrowsecurity then 'STARO — RLS nije uključen'
            else 'OK' end
  from (select unnest(array['ai_posao','api_usage','bug_report_usage',
                            'endpoint_usage','push_pretplata','user_state',
                            'zajednica_profil','zajednica_izazov','user_state_istorija',
                            'nalog_za_brisanje']) as ime) o
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
select 'politika · ai_posao.' || policyname, cmd, 'OK'
  from pg_policies where schemaname = 'public' and tablename = 'ai_posao'

union all

select 'politika · zajednica_profil.' || policyname, cmd, 'OK'
  from pg_policies where schemaname = 'public' and tablename = 'zajednica_profil'

union all

-- 6. IZAZOV SME DA SE SAMO ČITA
--    Jedan jedini red koji vide svi. Politika za upis nad njim — bilo koja —
--    znači da bilo koji prijavljen korisnik prepisuje izazov svima. Menja ga
--    isključivo vlasnik kroz /api/broadcast, service_role ključem.
select 'izazov · nijedna politika za upis',
       coalesce((select string_agg(distinct cmd, ', ') from pg_policies
                  where schemaname = 'public' and tablename = 'zajednica_izazov'
                    and cmd <> 'SELECT'), 'nema'),
       case when to_regclass('public.zajednica_izazov') is null then 'NEDOSTAJE'
            when exists (select 1 from pg_policies
                          where schemaname = 'public' and tablename = 'zajednica_izazov'
                            and cmd <> 'SELECT')
              /* Puštanje zajednica.sql ponovo ovo NE popravlja — fajl briše
                 samo politiku koju sam pravi, po imenu. Tuđu treba obrisati
                 rukom: `drop policy <ime> on public.zajednica_izazov`. */
              then 'STARO — neko sme da menja izazov kroz RLS; obriši tu politiku rukom'
            else 'OK' end

union all

-- 6a. ISTORIJA VERZIJA SE SAMO ČITA
--     Isto pravilo kao za izazov, iz drugog razloga: istorija u koju korisnik
--     može da piše ili da briše ne štiti od greške napravljene U APLIKACIJI.
--     Piše je isključivo okidač, koji je `security definer`.
select 'istorija · nijedna politika za upis',
       coalesce((select string_agg(distinct cmd, ', ') from pg_policies
                  where schemaname = 'public' and tablename = 'user_state_istorija'
                    and cmd <> 'SELECT'), 'nema'),
       case when to_regclass('public.user_state_istorija') is null then 'NEDOSTAJE'
            when exists (select 1 from pg_policies
                          where schemaname = 'public' and tablename = 'user_state_istorija'
                            and cmd <> 'SELECT')
              /* Puštanje istorija.sql ponovo ovo NE popravlja — fajl briše samo
                 politiku koju sam pravi, po imenu. Tuđu obriši rukom. */
              then 'STARO — neko sme da menja istoriju kroz RLS; obriši tu politiku rukom'
            else 'OK' end

union all

select 'istorija · anon nema pristup',
       case when to_regclass('public.user_state_istorija') is null then '—'
            when not exists (select 1 from pg_roles where rolname = 'anon') then 'nema uloge anon'
            when has_table_privilege('anon', 'public.user_state_istorija', 'select') then 'ČITA'
            else 'nema' end,
       case when to_regclass('public.user_state_istorija') is null then 'NEDOSTAJE'
            when not exists (select 1 from pg_roles where rolname = 'anon') then 'OK'
            when has_table_privilege('anon', 'public.user_state_istorija', 'select')
              then 'STARO — pusti istorija.sql ponovo (revoke iz tačke 3)'
            else 'OK' end

union all

-- 6b. SPISAK ZA BRISANJE NE VIDI NIKO OSIM SERVERA
--     To je spisak tuđih e-adresa. Ni `anon` ni `authenticated` ne smeju ni da
--     ga pročitaju — radi se isključivo service_role ključem iz Vercel-a.
select 'brisanje · samo server ima pristup',
       case when to_regclass('public.nalog_za_brisanje') is null then '—'
            when exists (select 1 from pg_policies
                          where schemaname = 'public' and tablename = 'nalog_za_brisanje') then 'ima politiku'
            when has_table_privilege('authenticated', 'public.nalog_za_brisanje', 'select') then 'prijavljen ČITA'
            else 'nema' end,
       case when to_regclass('public.nalog_za_brisanje') is null then 'NEDOSTAJE — pusti admin-brisanje.sql'
            when exists (select 1 from pg_policies
                          where schemaname = 'public' and tablename = 'nalog_za_brisanje')
              then 'STARO — postoji politika; obriši je rukom'
            when has_table_privilege('authenticated', 'public.nalog_za_brisanje', 'select')
              then 'STARO — pusti admin-brisanje.sql ponovo (revoke iz tačke 2)'
            else 'OK' end

union all

-- 7. ANON NE SME DO ZAJEDNICE
--    anon ključ stoji u izvornom kodu stranice, dakle kod svakoga. Da `revoke`
--    izostane, ceo spisak trkača bi se čitao bez prijave.
select 'zajednica · anon nema pristup',
       case when to_regclass('public.zajednica_profil') is null then '—'
            when not exists (select 1 from pg_roles where rolname = 'anon') then 'nema uloge anon'
            when has_table_privilege('anon', 'public.zajednica_profil', 'select') then 'ČITA'
            else 'nema' end,
       case when to_regclass('public.zajednica_profil') is null then 'NEDOSTAJE'
            when not exists (select 1 from pg_roles where rolname = 'anon') then 'OK'
            when has_table_privilege('anon', 'public.zajednica_profil', 'select')
              then 'STARO — pusti zajednica.sql ponovo (revoke iz tačke 3)'
            else 'OK' end

order by 1;

-- =====================================================================
-- ŠTA URADITI SA NALAZOM
--
--   sve OK                        -> baza i repozitorijum se poklapaju
--   NEDOSTAJE kod ai_posao_*      -> pusti supabase/ai-posao.sql
--   NEDOSTAJE kod api_usage       -> pusti supabase/api-usage.sql
--   NEDOSTAJE kod endpoint_usage  -> pusti supabase/rate-limit.sql
--   NEDOSTAJE kod zajednica_*     -> pusti supabase/zajednica.sql
--   NEDOSTAJE kod user_state_*    -> pusti supabase/istorija.sql
--   NEDOSTAJE kod nalog_za_brisanje -> pusti supabase/admin-brisanje.sql
--   STARO                         -> pusti taj isti fajl ponovo, ceo
--
-- Puštanje bilo kog od tih fajlova dvaput je bezbedno.
-- =====================================================================
