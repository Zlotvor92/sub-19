-- Apply only after the new backend uses ai_posao_otvori and server-filtered writes.
REVOKE ALL ON public.ai_posao FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.ai_posao TO authenticated;
DROP POLICY IF EXISTS ai_posao_pisi ON public.ai_posao;
DROP POLICY IF EXISTS ai_posao_menjaj ON public.ai_posao;
DROP POLICY IF EXISTS ai_posao_brisi ON public.ai_posao;
NOTIFY pgrst,'reload schema';
