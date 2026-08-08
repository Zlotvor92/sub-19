-- =====================================================================
-- SUB-20 — ŠTA JE U BAZI, A NIJE U REPOZITORIJUMU
--
-- ZAŠTO POSTOJI
-- Šema se puštala rukom kroz SQL Editor, pa se u njemu nakupilo dvadesetak
-- snippet-ova. Snippet je SAMO SAČUVAN TEKST — brisanje taba ne poništava
-- ništa, jer ono što je pušteno već živi u bazi. Jedino što se brisanjem gubi
-- je tekst koji nigde drugde ne postoji.
--
-- Tako je i nastao problem sa `user_state`: napravljena je u jednom takvom
-- tabu koji nikad nije prepisan u repozitorijum, pa nije postojalo ništa sa
-- čim bi se njene politike uporedile.
--
-- OVAJ UPIT ODGOVARA NA JEDNO PITANJE: smem li da obrišem te tabove.
--   Ako je sve „u repozitorijumu" — smeš, sve postoji i u fajlovima.
--   Ako se pojavi „NEPOZNATO" — to je nešto što postoji samo u bazi. Nađi
--   snippet koji ga je napravio i prepiši ga u supabase/ PRE brisanja.
--
-- BEZBEDNO JE: samo čita katalog. Nijedan red podataka ne izlazi.
-- Ništa ne menja — može se pustiti kad god.
-- =====================================================================

with ocekivano as (
  select unnest(array[
    -- tabele (v. istoimene fajlove u supabase/)
    'tabela:ai_posao','tabela:api_usage','tabela:bug_report_usage',
    'tabela:endpoint_usage','tabela:nalog_za_brisanje','tabela:push_pretplata',
    'tabela:user_state','tabela:user_state_istorija',
    'tabela:zajednica_izazov','tabela:zajednica_profil',
    -- funkcije
    'funkcija:ai_posao_dodirni','funkcija:ai_posao_nov','funkcija:ai_posao_prelaz',
    'funkcija:check_and_bump_api_usage','funkcija:check_and_bump_bug_usage',
    'funkcija:check_and_bump_endpoint','funkcija:obrisi_naloge',
    'funkcija:push_pretplata_dodirni','funkcija:user_state_touch',
    'funkcija:user_state_zapamti','funkcija:zajednica_profil_dodirni',
    'funkcija:zajednica_vidljiv_ja',
    -- okidači
    'okidač:ai_posao_dodirni_trg','okidač:ai_posao_nov_trg','okidač:ai_posao_prelaz_trg',
    'okidač:push_pretplata_dodirni_trg','okidač:user_state_touch_trg',
    'okidač:user_state_zapamti_trg','okidač:zajednica_profil_dodirni_trg'
  ] ) as kljuc
),
stvarno as (
  select 'tabela'   as vrsta, c.relname::text as ime, 'tabela:'   || c.relname as kljuc
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r','p')
  union all
  select 'funkcija', p.proname::text, 'funkcija:' || p.proname
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.prokind = 'f'
  union all
  select 'okidač', t.tgname::text, 'okidač:' || t.tgname
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and not t.tgisinternal
)
select s.vrsta,
       s.ime,
       case when o.kljuc is null
            then 'NEPOZNATO — postoji samo u bazi, nije ni u jednom fajlu u supabase/'
            else 'u repozitorijumu' end as nalaz
  from stvarno s
  left join ocekivano o on o.kljuc = s.kljuc

union all

-- I obrnut smer: fajl opisuje nešto čega u bazi nema — znači da taj fajl
-- nikad nije pušten, pa deo aplikacije tiho ne radi.
select split_part(o.kljuc, ':', 1),
       split_part(o.kljuc, ':', 2),
       'NEDOSTAJE U BAZI — pusti odgovarajući fajl iz supabase/'
  from ocekivano o
 where o.kljuc not in (select kljuc from stvarno)

order by 3 desc, 1, 2;
