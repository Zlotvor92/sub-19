-- Prepisano iz žive baze (supabase_migrations.schema_migrations, verzija 20261012061314).
-- Puštena direktno u bazu, a nije bila u repozitorijumu. Jedina razlika od prethodne:
-- `strava_povezana` je false umesto null kad korisnik nema red u user_state.
create or replace view public.admin_korisnici as
with trening as (
  select s.user_id,
         count(*) filter (where l.value->>'status' = 'done')                                  as treninga,
         round(sum((l.value->>'km')::numeric) filter (
           where l.value->>'status' = 'done' and jsonb_typeof(l.value->'km') = 'number'), 1)  as km_ukupno,
         max(l.value->>'runDate')                                                             as poslednji_trening,
         count(*) filter (where l.value->>'src' = 'strava')                                   as sa_strave
  from public.user_state s
  left join lateral jsonb_each(case when jsonb_typeof(s.data->'log') = 'object' then s.data->'log' else '{}'::jsonb end) l on true
  group by s.user_id
),
ai as (select user_id, sum(calls) as ai_pozivi, max(day) as poslednji_ai_dan from public.api_usage group by user_id),
push as (select user_id, count(*) as push_uredjaja from public.push_pretplata group by user_id)
select
  u.id                                                                         as user_id,
  u.email,
  coalesce(u.raw_app_meta_data->>'provider', '?')                              as provajder,
  u.created_at                                                                 as nalog_otvoren,
  u.last_sign_in_at                                                            as poslednja_prijava,
  s.updated_at                                                                 as poslednji_sync,
  (current_date - coalesce(s.updated_at, u.created_at)::date)                  as dana_od_aktivnosti,
  (s.user_id is not null)                                                      as ima_user_state,
  (s.data->'genPlan' is not null and s.data->'genPlan' <> 'null'::jsonb)       as ima_plan,
  coalesce(jsonb_typeof(s.data->'strava') = 'object', false)                   as strava_povezana,
  coalesce(t.treninga, 0)                                                      as treninga,
  coalesce(t.km_ukupno, 0)                                                     as km_ukupno,
  t.poslednji_trening,
  coalesce(a.ai_pozivi, 0)                                                     as ai_pozivi,
  coalesce(p.push_uredjaja, 0)                                                 as push_uredjaja,
  (z.user_id is not null)                                                      as ima_profil_zajednice,
  (n.user_id is not null)                                                      as oznacen_za_brisanje,
  (
    u.created_at < now() - interval '7 days'
    and coalesce(t.treninga, 0) = 0
    and not coalesce(s.data->'genPlan' is not null and s.data->'genPlan' <> 'null'::jsonb, false)
    and coalesce(a.ai_pozivi, 0) = 0
    and coalesce(p.push_uredjaja, 0) = 0
    and z.user_id is null
  )                                                                            as kandidat_za_ciscenje
from auth.users u
left join public.user_state s on s.user_id = u.id
left join trening t on t.user_id = u.id
left join ai a on a.user_id = u.id
left join push p on p.user_id = u.id
left join public.zajednica_profil z on z.user_id = u.id
left join public.nalog_za_brisanje n on n.user_id = u.id;
