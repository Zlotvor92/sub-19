-- =====================================================================
-- SUB-20 — PRAĆENJE KORIŠĆENJA APLIKACIJE PO KORISNIKU
--
-- ZAŠTO
-- Do sada je jedini trag korišćenja bio `user_state.updated_at` (poslednji
-- upis) i `auth.users.last_sign_in_at`, koji se ne pomera dok sesija važi.
-- Ne zna se ni kad je čovek otvorio aplikaciju, ni koliko često, ni da li je
-- pravio novi plan. Za odluku „koristi / ne koristi" to nije dovoljno.
--
-- ŠTA DODAJE
-- 1. `korisnik_dogadjaj` — jedan red po događaju (otvaranje, sinhronizacija,
--    nov plan, odrađen trening, povezana Strava…).
-- 2. `zabelezi_otvaranje()` — klijent je zove pri pokretanju i povratku u
--    aplikaciju. Najviše jedan zapis na 30 minuta po korisniku.
-- 3. Okidač na `user_state` — sve ostalo se čita iz razlike starog i novog
--    stanja, na serveru, bez ikakve izmene u aplikaciji.
-- 4. `admin_aktivnost` — jedan red po nalogu sa svim signalima i statusom.
-- 5. Popuna unazad iz `user_state_istorija` i postojećeg stanja.
--
-- ŠTA NE DIRA
-- `user_state` i njegovi podaci se ne menjaju. Okidač NIKAD ne obara upis:
-- sve je u `exception` bloku, kao kod istorije.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------------------
create table if not exists public.korisnik_dogadjaj (
  id          bigint generated always as identity primary key,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  vrsta       text        not null,
  napravljeno timestamptz not null default now(),
  app_version text,
  device_id   text,
  meta        jsonb
);

comment on table public.korisnik_dogadjaj is
  'Događaji korišćenja po korisniku. Piše ISKLJUČIVO okidač na user_state i zabelezi_otvaranje(); čita samo service_role.';

create index if not exists korisnik_dogadjaj_idx
  on public.korisnik_dogadjaj (user_id, vrsta, napravljeno desc);

-- RLS bez ijedne politike: ni čitanje ni upis kroz REST. Spisak tuđih
-- aktivnosti nije posao klijenta.
alter table public.korisnik_dogadjaj enable row level security;
revoke all on public.korisnik_dogadjaj from public;
revoke all on public.korisnik_dogadjaj from anon, authenticated;


-- ---------------------------------------------------------------------
-- 2. Otvaranje aplikacije (zove klijent)
-- ---------------------------------------------------------------------
create or replace function public.zabelezi_otvaranje(
  p_app_version text default null,
  p_device_id   text default null,
  p_platforma   text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    return;
  end if;
  -- Najviše jedan zapis na 30 minuta: klijent zove i na svaki povratak u
  -- aplikaciju, a bez praga bi jedno popodne napravilo stotine redova.
  if exists (
    select 1 from public.korisnik_dogadjaj
     where user_id = v_user and vrsta = 'otvaranje'
       and napravljeno > now() - interval '30 minutes'
  ) then
    return;
  end if;
  insert into public.korisnik_dogadjaj (user_id, vrsta, app_version, device_id, meta)
  values (
    v_user, 'otvaranje',
    left(p_app_version, 32),
    left(p_device_id, 64),
    case when p_platforma is null then null
         else jsonb_build_object('platforma', left(p_platforma, 32)) end
  );
end $$;

revoke all on function public.zabelezi_otvaranje(text, text, text) from public, anon;
grant execute on function public.zabelezi_otvaranje(text, text, text) to authenticated;


-- ---------------------------------------------------------------------
-- 3. Okidač na user_state
-- ---------------------------------------------------------------------
create or replace function public.korisnik_dogadjaj_iz_stanja()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  o jsonb := case when TG_OP = 'UPDATE' then OLD.data else '{}'::jsonb end;
  n jsonb := coalesce(NEW.data, '{}'::jsonb);
  ol jsonb;
  nl jsonb;
  ov jsonb;
  nv jsonb;
begin
  begin
    if TG_OP = 'INSERT' then
      insert into korisnik_dogadjaj (user_id, vrsta, app_version, device_id)
      values (NEW.user_id, 'prvi_upis', NEW.app_version, NEW.device_id);
    end if;

    -- Sinhronizacija: svaki upis je znak da je aplikacija radila. Najviše
    -- jedan zapis na 30 minuta (aplikacija gura 4 s posle svakog dodira).
    if not exists (
      select 1 from korisnik_dogadjaj
       where user_id = NEW.user_id and vrsta = 'sinhronizacija'
         and napravljeno > now() - interval '30 minutes'
    ) then
      insert into korisnik_dogadjaj (user_id, vrsta, app_version, device_id)
      values (NEW.user_id, 'sinhronizacija', NEW.app_version, NEW.device_id);
    end if;

    if TG_OP = 'UPDATE' and OLD.data is not distinct from NEW.data then
      return NEW;
    end if;

    -- Nov plan: promenjen ulaz generatora (novo generisanje ili nov cilj).
    if jsonb_typeof(n->'genPlan') = 'object'
       and (o->'genPlan'->'ulaz') is distinct from (n->'genPlan'->'ulaz') then
      insert into korisnik_dogadjaj (user_id, vrsta, app_version, device_id, meta)
      values (NEW.user_id, 'nov_plan', NEW.app_version, NEW.device_id,
        jsonb_build_object(
          'trka',  n->'genPlan'->'meta'->>'raceName',
          'datum', n->'genPlan'->'meta'->>'raceDate',
          'start', n->'genPlan'->'meta'->>'start',
          'nedelja', n->'genPlan'->'meta'->'weeks'));
    elsif jsonb_typeof(o->'genPlan') = 'object' and jsonb_typeof(n->'genPlan') is distinct from 'object' then
      insert into korisnik_dogadjaj (user_id, vrsta, app_version, device_id)
      values (NEW.user_id, 'plan_uklonjen', NEW.app_version, NEW.device_id);
    end if;

    -- Odrađeni treninzi: dan koji je sada `done`, a pre nije bio.
    ol := case when jsonb_typeof(o->'log') = 'object' then o->'log' else '{}'::jsonb end;
    nl := case when jsonb_typeof(n->'log') = 'object' then n->'log' else '{}'::jsonb end;
    insert into korisnik_dogadjaj (user_id, vrsta, app_version, device_id, meta)
    select NEW.user_id, 'trening', NEW.app_version, NEW.device_id,
           jsonb_build_object(
             'dan', e.key,
             'datum', left(coalesce(e.value->>'runDate', e.value->>'ts'), 10),
             'km', e.value->'km',
             'izvor', e.value->>'src')
      from jsonb_each(nl) e
     where e.value->>'status' = 'done'
       and coalesce(ol->e.key->>'status', '') <> 'done';

    -- Trčanja van plana: nov datum u `vanPlana`.
    ov := case when jsonb_typeof(o->'vanPlana') = 'object' then o->'vanPlana' else '{}'::jsonb end;
    nv := case when jsonb_typeof(n->'vanPlana') = 'object' then n->'vanPlana' else '{}'::jsonb end;
    insert into korisnik_dogadjaj (user_id, vrsta, app_version, device_id, meta)
    select NEW.user_id, 'van_plana', NEW.app_version, NEW.device_id,
           jsonb_build_object('datum', e.key, 'km', e.value)
      from jsonb_each(nv) e
     where not (ov ? e.key);

    -- Veze sa satom.
    if jsonb_typeof(n->'strava') = 'object' and jsonb_typeof(o->'strava') is distinct from 'object' then
      insert into korisnik_dogadjaj (user_id, vrsta, app_version, device_id)
      values (NEW.user_id, 'strava_povezana', NEW.app_version, NEW.device_id);
    elsif jsonb_typeof(o->'strava') = 'object' and jsonb_typeof(n->'strava') is distinct from 'object' then
      insert into korisnik_dogadjaj (user_id, vrsta, app_version, device_id)
      values (NEW.user_id, 'strava_otkacena', NEW.app_version, NEW.device_id);
    end if;
    if jsonb_typeof(n->'icu') = 'object' and n->'icu' <> '{}'::jsonb
       and not (jsonb_typeof(o->'icu') = 'object' and o->'icu' <> '{}'::jsonb) then
      insert into korisnik_dogadjaj (user_id, vrsta, app_version, device_id)
      values (NEW.user_id, 'icu_povezan', NEW.app_version, NEW.device_id);
    end if;

    -- Ručni unosi: bol, težina, test na 3 km.
    if jsonb_typeof(n->'knee') = 'array'
       and jsonb_array_length(n->'knee') > coalesce(case when jsonb_typeof(o->'knee') = 'array' then jsonb_array_length(o->'knee') end, 0) then
      insert into korisnik_dogadjaj (user_id, vrsta, app_version, device_id)
      values (NEW.user_id, 'unos_bola', NEW.app_version, NEW.device_id);
    end if;
    if jsonb_typeof(n->'kg') = 'array'
       and jsonb_array_length(n->'kg') > coalesce(case when jsonb_typeof(o->'kg') = 'array' then jsonb_array_length(o->'kg') end, 0) then
      insert into korisnik_dogadjaj (user_id, vrsta, app_version, device_id)
      values (NEW.user_id, 'unos_tezine', NEW.app_version, NEW.device_id);
    end if;
    if jsonb_typeof(n->'t3k') = 'array'
       and jsonb_array_length(n->'t3k') > coalesce(case when jsonb_typeof(o->'t3k') = 'array' then jsonb_array_length(o->'t3k') end, 0) then
      insert into korisnik_dogadjaj (user_id, vrsta, app_version, device_id)
      values (NEW.user_id, 'test_3k', NEW.app_version, NEW.device_id);
    end if;
  exception when others then
    -- Praćenje je sporedno; sinhronizacija ne sme da padne zbog njega.
    raise warning '[aktivnost] događaj nije zabeležen za %: %', NEW.user_id, sqlerrm;
  end;
  return NEW;
end $$;

revoke all on function public.korisnik_dogadjaj_iz_stanja() from public, anon, authenticated;

-- `create or replace`, ne `drop` + `create`: između ta dva koraka upis stanja
-- bi prošao bez okidača.
create or replace trigger korisnik_dogadjaj_trg
  after insert or update on public.user_state
  for each row execute function public.korisnik_dogadjaj_iz_stanja();


-- ---------------------------------------------------------------------
-- 4. Popuna unazad (samo jednom — puštanje dvaput ne duplira)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from public.korisnik_dogadjaj where meta->>'izvor' = 'popuna') then
    return;
  end if;

  -- Prvi upis stanja.
  insert into public.korisnik_dogadjaj (user_id, vrsta, napravljeno, app_version, device_id, meta)
  select user_id, 'prvi_upis', created_at, null, null, '{"izvor":"popuna"}'::jsonb
    from public.user_state where created_at is not null;

  -- Svaka sačuvana verzija = upis koji se desio u tom trenutku.
  insert into public.korisnik_dogadjaj (user_id, vrsta, napravljeno, app_version, device_id, meta)
  select user_id, 'sinhronizacija', napravljeno, app_version, device_id, '{"izvor":"popuna"}'::jsonb
    from public.user_state_istorija;

  -- Poslednji upis.
  insert into public.korisnik_dogadjaj (user_id, vrsta, napravljeno, app_version, device_id, meta)
  select user_id, 'sinhronizacija', updated_at, app_version, device_id, '{"izvor":"popuna"}'::jsonb
    from public.user_state where updated_at is not null;

  -- Novi planovi: verzija u kojoj se ulaz generatora prvi put pojavio.
  -- Vreme je približno (trenutak sledećeg upisa, ne samog generisanja).
  insert into public.korisnik_dogadjaj (user_id, vrsta, napravljeno, meta)
  select user_id, 'nov_plan', at,
         jsonb_build_object('izvor', 'popuna', 'trka', trka, 'datum', datum)
    from (
      select user_id, at, ulaz, trka, datum,
             lag(ulaz) over (partition by user_id order by at) as pre
        from (
          select user_id, napravljeno as at, data->'genPlan'->'ulaz' as ulaz,
                 data->'genPlan'->'meta'->>'raceName' as trka,
                 data->'genPlan'->'meta'->>'raceDate' as datum
            from public.user_state_istorija
          union all
          select user_id, updated_at, data->'genPlan'->'ulaz',
                 data->'genPlan'->'meta'->>'raceName',
                 data->'genPlan'->'meta'->>'raceDate'
            from public.user_state
        ) v
    ) x
   where ulaz is not null and jsonb_typeof(ulaz) = 'object' and ulaz is distinct from pre;

  -- Odrađeni treninzi iz trenutnog stanja, po danu trčanja (podne).
  insert into public.korisnik_dogadjaj (user_id, vrsta, napravljeno, meta)
  select s.user_id, 'trening',
         (left(coalesce(e.value->>'runDate', e.value->>'ts'), 10) || ' 12:00')::timestamp at time zone 'Europe/Belgrade',
         jsonb_build_object('izvor', 'popuna', 'dan', e.key,
           'datum', left(coalesce(e.value->>'runDate', e.value->>'ts'), 10),
           'km', e.value->'km')
    from public.user_state s,
         jsonb_each(case when jsonb_typeof(s.data->'log') = 'object' then s.data->'log' else '{}'::jsonb end) e
   where e.value->>'status' = 'done'
     and coalesce(e.value->>'runDate', e.value->>'ts') ~ '^\d{4}-\d{2}-\d{2}';

  insert into public.korisnik_dogadjaj (user_id, vrsta, napravljeno, meta)
  select s.user_id, 'van_plana',
         (e.key || ' 12:00')::timestamp at time zone 'Europe/Belgrade',
         jsonb_build_object('izvor', 'popuna', 'datum', e.key, 'km', e.value)
    from public.user_state s,
         jsonb_each(case when jsonb_typeof(s.data->'vanPlana') = 'object' then s.data->'vanPlana' else '{}'::jsonb end) e
   where e.key ~ '^\d{4}-\d{2}-\d{2}$';
end $$;


-- ---------------------------------------------------------------------
-- 5. Pregled po korisniku
--
-- TRENING se broji iz STANJA (plan `done` + `vanPlana`), i samo od dana
-- registracije: Strava pri povezivanju uveze stara trčanja, a ona ne govore
-- ništa o korišćenju aplikacije.
--
-- STATUS:
--   oznacen_za_brisanje — već u nalog_za_brisanje
--   trci                — trening u poslednjih 14 dana
--   otvara_ne_trci      — otvara/sinhronizuje u 14 dana, a treninga nema
--   nov                 — nalog mlađi od 7 dana, još bez treninga
--   neaktivan           — ništa od navedenog
-- KANDIDAT ZA BRISANJE: nalog stariji od 14 dana, bez treninga u 30 dana i
-- bez ikakve aktivnosti (otvaranje, upis, poziv servera, AI) u 14 dana.
-- ---------------------------------------------------------------------
-- Bez `security_invoker`: pogled čita auth.users, pa radi u pravima vlasnika,
-- a pravo čitanja ima samo service_role (v. revoke ispod) — isto kao admin_korisnici.
create or replace view public.admin_aktivnost as
with
trcanja as (
  select s.user_id,
         left(coalesce(e.value->>'runDate', e.value->>'ts'), 10)::date as dan,
         case when jsonb_typeof(e.value->'km') = 'number' then (e.value->>'km')::numeric end as km
    from public.user_state s,
         jsonb_each(case when jsonb_typeof(s.data->'log') = 'object' then s.data->'log' else '{}'::jsonb end) e
   where e.value->>'status' = 'done'
     and coalesce(e.value->>'runDate', e.value->>'ts') ~ '^\d{4}-\d{2}-\d{2}'
  union all
  select s.user_id, e.key::date,
         case when jsonb_typeof(e.value) = 'number' then (e.value#>>'{}')::numeric end
    from public.user_state s,
         jsonb_each(case when jsonb_typeof(s.data->'vanPlana') = 'object' then s.data->'vanPlana' else '{}'::jsonb end) e
   where e.key ~ '^\d{4}-\d{2}-\d{2}$'
),
tr as (
  select t.user_id,
         count(*) filter (where t.dan >= u.created_at::date)                                as treninga,
         round(coalesce(sum(t.km) filter (where t.dan >= u.created_at::date), 0), 1)        as km,
         count(*) filter (where t.dan >= current_date - 30 and t.dan >= u.created_at::date)  as treninga_30d,
         count(*) filter (where t.dan < u.created_at::date)                                 as uvezeno_pre_naloga,
         max(t.dan) filter (where t.dan >= u.created_at::date)                              as poslednji_trening
    from trcanja t join auth.users u on u.id = t.user_id
   group by t.user_id
),
ev as (
  select user_id,
         max(napravljeno) filter (where vrsta = 'otvaranje')                                      as poslednje_otvaranje,
         count(*) filter (where vrsta = 'otvaranje')                                              as otvaranja,
         count(*) filter (where vrsta = 'otvaranje' and napravljeno > now() - interval '7 days')  as otvaranja_7d,
         count(distinct (napravljeno at time zone 'Europe/Belgrade')::date)
           filter (where vrsta in ('otvaranje', 'sinhronizacija') and napravljeno > now() - interval '30 days')
                                                                                                  as aktivnih_dana_30d,
         count(*) filter (where vrsta = 'nov_plan')                                               as planova_napravljeno,
         max(napravljeno) filter (where vrsta = 'nov_plan')                                       as poslednji_nov_plan,
         count(distinct device_id) filter (where device_id is not null)                           as uredjaja,
         max(napravljeno) filter (where vrsta in ('otvaranje', 'sinhronizacija'))                 as poslednji_znak
    from public.korisnik_dogadjaj
   group by user_id
),
ai as (select user_id, sum(calls) as ai_analiza, max(day) as poslednja_ai from public.api_usage group by user_id),
srv as (select user_id, max(dan) as poslednji_poziv_servera from public.endpoint_usage group by user_id),
push as (select user_id, count(*) as push_uredjaja from public.push_pretplata group by user_id),
osnova as (
  select
    u.id                                                                        as user_id,
    u.email,
    coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name') as ime,
    u.created_at                                                                as registrovan,
    (current_date - u.created_at::date)                                         as dana_od_registracije,
    u.last_sign_in_at                                                           as poslednja_prijava,
    ev.poslednje_otvaranje,
    coalesce(ev.otvaranja, 0)                                                   as otvaranja,
    coalesce(ev.otvaranja_7d, 0)                                                as otvaranja_7d,
    coalesce(ev.aktivnih_dana_30d, 0)                                           as aktivnih_dana_30d,
    s.updated_at                                                                as poslednja_sinhronizacija,
    s.app_version                                                               as verzija_aplikacije,
    coalesce(ev.uredjaja, 0)                                                    as uredjaja,
    coalesce(jsonb_typeof(s.data->'genPlan') = 'object', false)                 as ima_plan,
    s.data->'genPlan'->'meta'->>'raceName'                                      as plan_trka,
    (s.data->'genPlan'->'meta'->>'raceDate')                                    as plan_datum_trke,
    coalesce(ev.planova_napravljeno, 0)                                         as planova_napravljeno,
    ev.poslednji_nov_plan,
    coalesce(tr.treninga, 0)                                                    as treninga,
    coalesce(tr.km, 0)                                                          as km,
    coalesce(tr.treninga_30d, 0)                                                as treninga_30d,
    coalesce(tr.uvezeno_pre_naloga, 0)                                          as uvezeno_pre_naloga,
    tr.poslednji_trening,
    coalesce(jsonb_typeof(s.data->'strava') = 'object', false)                  as strava,
    coalesce(jsonb_typeof(s.data->'icu') = 'object' and s.data->'icu' <> '{}'::jsonb, false) as icu,
    coalesce(p.push_uredjaja, 0)                                                as push_uredjaja,
    coalesce(ai.ai_analiza, 0)                                                  as ai_analiza,
    ai.poslednja_ai,
    srv.poslednji_poziv_servera,
    (z.user_id is not null)                                                     as profil_zajednice,
    (n.user_id is not null)                                                     as oznacen_za_brisanje,
    greatest(
      ev.poslednji_znak, s.updated_at,
      ai.poslednja_ai::timestamptz, srv.poslednji_poziv_servera::timestamptz
    )                                                                           as poslednja_aktivnost
  from auth.users u
  left join public.user_state s        on s.user_id = u.id
  left join tr                         on tr.user_id = u.id
  left join ev                         on ev.user_id = u.id
  left join ai                         on ai.user_id = u.id
  left join srv                        on srv.user_id = u.id
  left join push p                     on p.user_id = u.id
  left join public.zajednica_profil z  on z.user_id = u.id
  left join public.nalog_za_brisanje n on n.user_id = u.id
)
select
  o.*,
  (current_date - coalesce(o.poslednja_aktivnost, o.registrovan)::date)        as dana_neaktivan,
  (current_date - o.poslednji_trening)                                          as dana_od_treninga,
  case
    when o.oznacen_za_brisanje                                                   then 'oznacen_za_brisanje'
    when o.poslednji_trening >= current_date - 14                                then 'trci'
    when o.poslednja_aktivnost > now() - interval '14 days'
         and o.registrovan <= now() - interval '7 days'                          then 'otvara_ne_trci'
    when o.registrovan > now() - interval '7 days'                               then 'nov'
    else 'neaktivan'
  end                                                                           as status,
  (
    not o.oznacen_za_brisanje
    and o.registrovan <= now() - interval '14 days'
    and o.treninga_30d = 0
    and coalesce(o.poslednja_aktivnost, o.registrovan) <= now() - interval '14 days'
  )                                                                             as kandidat_za_brisanje
from osnova o;

comment on view public.admin_aktivnost is
  'Jedan red po nalogu: otvaranja, sinhronizacije, planovi, treninzi, veze, status i kandidat za brisanje. Samo service_role.';

revoke all on public.admin_aktivnost from public;
revoke all on public.admin_aktivnost from anon, authenticated;

notify pgrst, 'reload schema';
