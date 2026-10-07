-- Production hardening; service_role and all existing superadmin functions remain untouched.
-- Runs before backend deployment. The final migration revokes legacy AI writes after the new backend is live.

REVOKE ALL ON public.user_state, public.user_state_istorija, public.ai_posao,
 public.push_pretplata, public.zajednica_profil, public.zajednica_izazov FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_state, public.ai_posao,
 public.push_pretplata, public.zajednica_profil TO authenticated;
GRANT SELECT ON public.user_state_istorija, public.zajednica_izazov TO authenticated;

-- PUBLIC revocation alone does not remove Supabase's direct anon grants.
REVOKE EXECUTE ON FUNCTION public.check_and_bump_api_usage(integer),
 public.check_and_bump_bug_usage(integer), public.check_and_bump_endpoint(text,integer),
 public.zajednica_vidljiv_ja() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_and_bump_api_usage(integer),
 public.check_and_bump_bug_usage(integer), public.check_and_bump_endpoint(text,integer),
 public.zajednica_vidljiv_ja() TO authenticated, service_role;

-- These functions can only run as triggers. Do not alter their execution context.
DO $hardening$
DECLARE fn record; owner_role text;
BEGIN
 FOR fn IN SELECT oid::regprocedure AS signature FROM pg_proc
  WHERE pronamespace='public'::regnamespace AND prorettype='trigger'::regtype LOOP
  EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',fn.signature);
 END LOOP;
 FOR fn IN SELECT oid::regprocedure AS signature FROM pg_proc
  WHERE pronamespace='public'::regnamespace AND proname IN
   ('ai_posao_dodirni','ai_posao_prelaz','push_pretplata_dodirni','zajednica_profil_dodirni','user_state_touch') LOOP
  EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog',fn.signature);
 END LOOP;
 -- Only public application objects; never auth, storage or existing superadmin grants.
 FOREACH owner_role IN ARRAY ARRAY['postgres','supabase_admin'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=owner_role) AND pg_has_role(current_user,owner_role,'USAGE') THEN
   EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated',owner_role);
   EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated',owner_role);
   EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC',owner_role);
   EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated',owner_role);
  END IF;
 END LOOP;
END $hardening$;

-- Preserve row ownership and opt-in community visibility, and compute UID once per statement.
DROP POLICY IF EXISTS api_usage_own ON public.api_usage;
DO $policies$
DECLARE p record; q text; c text; ddl text;
BEGIN
 FOR p IN SELECT * FROM pg_policies WHERE schemaname='public' LOOP
  q := replace(replace(p.qual,'auth.uid()','(select auth.uid())'),'zajednica_vidljiv_ja()','(select public.zajednica_vidljiv_ja())');
  c := replace(p.with_check,'auth.uid()','(select auth.uid())');
  ddl := format('ALTER POLICY %I ON public.%I TO authenticated',p.policyname,p.tablename);
  IF q IS NOT NULL THEN ddl := ddl || ' USING ('||q||')'; END IF;
  IF c IS NOT NULL THEN ddl := ddl || ' WITH CHECK ('||c||')'; END IF;
  EXECUTE ddl;
 END LOOP;
END $policies$;

ALTER TABLE public.user_state ADD CONSTRAINT user_state_data_object CHECK(jsonb_typeof(data)='object') NOT VALID;
ALTER TABLE public.user_state ADD CONSTRAINT user_state_log_object CHECK(NOT(data ? 'log') OR jsonb_typeof(data->'log')='object') NOT VALID;
ALTER TABLE public.user_state ADD CONSTRAINT user_state_vdot_log_array CHECK(NOT(data ? 'vdotLog') OR jsonb_typeof(data->'vdotLog')='array') NOT VALID;
ALTER TABLE public.user_state ADD CONSTRAINT user_state_plan_object CHECK(NOT(data ? 'genPlan') OR jsonb_typeof(data->'genPlan') IN('object','null')) NOT VALID;
ALTER TABLE public.user_state VALIDATE CONSTRAINT user_state_data_object;
ALTER TABLE public.user_state VALIDATE CONSTRAINT user_state_log_object;
ALTER TABLE public.user_state VALIDATE CONSTRAINT user_state_vdot_log_array;
ALTER TABLE public.user_state VALIDATE CONSTRAINT user_state_plan_object;
-- created_at is server-owned; data has the same default on a fresh install and production.
ALTER TABLE public.user_state ALTER COLUMN data SET DEFAULT '{}'::jsonb;
REVOKE UPDATE ON public.user_state FROM authenticated;
GRANT UPDATE(user_id,data,device_id,app_version) ON public.user_state TO authenticated;

CREATE OR REPLACE VIEW public.app_stats WITH(security_invoker=true) AS
SELECT count(*) AS korisnika,
 count(*) FILTER(WHERE updated_at>now()-interval '24 hours') AS aktivnih_24h,
 count(*) FILTER(WHERE updated_at>now()-interval '7 days') AS aktivnih_7d,
 count(*) FILTER(WHERE updated_at>now()-interval '30 days') AS aktivnih_30d,
 count(*) FILTER(WHERE created_at>now()-interval '7 days') AS novih_7d,
 round(avg((SELECT count(*) FROM jsonb_object_keys(CASE WHEN jsonb_typeof(data->'log')='object' THEN data->'log' ELSE '{}'::jsonb END)))) AS prosek_treninga,
 round(avg(jsonb_array_length(CASE WHEN jsonb_typeof(data->'vdotLog')='array' THEN data->'vdotLog' ELSE '[]'::jsonb END))) AS prosek_vdot_unosa,
 count(*) FILTER(WHERE data->'genPlan' IS NOT NULL AND data->'genPlan'<>'null'::jsonb) AS sa_generisanim_planom
FROM public.user_state;
REVOKE ALL ON public.app_stats FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.app_stats TO service_role;

ALTER TABLE public.ai_posao ADD COLUMN kvota_uracunata boolean NOT NULL DEFAULT false;
ALTER TABLE public.ai_posao ADD COLUMN kvota_dan date;
CREATE FUNCTION public.ai_posao_kvota_zastiti()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $fn$
BEGIN
 IF current_user NOT IN('postgres','service_role') THEN
  IF TG_OP='INSERT' THEN NEW.kvota_uracunata:=false; NEW.kvota_dan:=null;
  ELSIF NEW.kvota_uracunata IS DISTINCT FROM OLD.kvota_uracunata OR NEW.kvota_dan IS DISTINCT FROM OLD.kvota_dan THEN
   RAISE EXCEPTION 'AI_POSAO_KVOTA' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.ai_posao_kvota_zastiti() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ai_posao_kvota_zastiti_trg BEFORE INSERT OR UPDATE ON public.ai_posao
 FOR EACH ROW EXECUTE FUNCTION public.ai_posao_kvota_zastiti();

-- No SECURITY DEFINER: service_role already has its own, explicitly granted access.
-- Called only by the backend AFTER verifying the user and the owner's unchanged exception.
CREATE FUNCTION public.ai_posao_otvori(p_user_id uuid,p_limit integer)
RETURNS uuid LANGUAGE plpgsql SET search_path=pg_catalog AS $fn$
DECLARE v_dan date:=(now() at time zone 'Europe/Belgrade')::date; v_broj integer; v_id uuid;
BEGIN
 IF p_user_id IS NULL OR p_limit IS NULL OR p_limit<1 OR p_limit>100000 THEN
  RAISE EXCEPTION 'BAD_LIMIT' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.api_usage AS u(user_id,day,calls) VALUES(p_user_id,v_dan,1)
 ON CONFLICT(user_id,day) DO UPDATE SET calls=u.calls+1 RETURNING calls INTO v_broj;
 IF v_broj>p_limit THEN RAISE EXCEPTION 'DAILY_LIMIT_EXCEEDED' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.ai_posao(user_id,kvota_uracunata,kvota_dan) VALUES(p_user_id,true,v_dan) RETURNING id INTO v_id;
 DELETE FROM public.api_usage WHERE user_id=p_user_id AND day<v_dan-90;
 DELETE FROM public.ai_posao WHERE user_id=p_user_id AND napravljen<now()-interval '24 hours' AND id<>v_id;
 RETURN v_id;
END $fn$;
REVOKE ALL ON FUNCTION public.ai_posao_otvori(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ai_posao_otvori(uuid,integer) TO service_role;
NOTIFY pgrst,'reload schema';
