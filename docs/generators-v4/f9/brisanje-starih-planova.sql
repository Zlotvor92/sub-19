-- Brisanje 19 planova starog formata iz baze (odluka vlasnika 15. 11. 2026).
-- Nalepi CEO tekst u Supabase → SQL Editor (projekat Sub20) i pokreni jednom.
-- Sve je u jednom bloku: ako ne pogađa TAČNO 19 naloga i ne zadržava TAČNO 3, prekida se i ništa se ne menja.
-- Ne dira: vlasnikov nalog, lični plan, v2 planove čija trka nije prošla. Rezerva: šema rezerva_20261114.
do $$
declare n_del int; n_keep int;
begin
  create temp table za_brisanje on commit drop as
    select user_id from public.user_state
     where jsonb_typeof(data->'genPlan') = 'object'
       and user_id <> '0403f8fb-a643-4d4e-843d-f71199a0d6f9'
       and coalesce(data->'genPlan'->'meta'->>'licni','false') <> 'true'
       and not ((data->'genPlan' ?| array['fiveKV2','tenKV2','hmV2','marathonV2']
                 or coalesce(data->'genPlan'->'meta'->>'policyId','') like '%-v2.%'
                 or coalesce(data->'genPlan'->'meta'->>'policyVersion','') like '%-v2.%')
                and coalesce(data->'genPlan'->'meta'->>'raceDate','')
                    >= to_char(now() at time zone 'Europe/Belgrade','YYYY-MM-DD'));
  select count(*) into n_del from za_brisanje;
  select count(*) into n_keep from public.user_state
   where jsonb_typeof(data->'genPlan')='object' and user_id not in (select user_id from za_brisanje);
  if n_del <> 19 or n_keep <> 3 then
    raise exception 'Prekid: pogodjeno=%, zadrzano=% (ocekivano 19 i 3)', n_del, n_keep;
  end if;
  update public.user_state u
     set data = (u.data || jsonb_build_object(
       'genPlan', null, 'log', '{}'::jsonb, 'alts', '{}'::jsonb, 'moves', '{}'::jsonb,
       'pred', '{}'::jsonb, 'predLock', '{}'::jsonb, 'vdotLog', '[]'::jsonb, 'vanPlana', '{}'::jsonb,
       'knee', coalesce((select jsonb_agg(k) from jsonb_array_elements(coalesce(u.data->'knee','[]'::jsonb)) k
                          where coalesce(k->>'src','') = ''), '[]'::jsonb),
       'kg',   coalesce((select jsonb_agg(k) from jsonb_array_elements(coalesce(u.data->'kg','[]'::jsonb)) k
                          where coalesce(k->>'src','') = ''), '[]'::jsonb),
       'ui',   coalesce(u.data->'ui','{}'::jsonb) || '{"seenWeek":null,"snooze":null}'::jsonb)) - 'vanPlanaV2'
   where u.user_id in (select user_id from za_brisanje);
  delete from public.user_state_istorija where user_id in (select user_id from za_brisanje);
end $$;

-- Provera posle (samo čitanje): mora dati 3.
select count(*) as naloga_sa_planom from public.user_state where jsonb_typeof(data->'genPlan') = 'object';
