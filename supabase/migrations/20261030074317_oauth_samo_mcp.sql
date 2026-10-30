-- =====================================================================
-- SUB-20 — OAUTH TOKEN (CLAUDE KONEKTOR) NEMA PRISTUP BAZI
--
-- ZAŠTO
-- Claude se povezuje na /api/mcp tokenom koji izdaje Supabase OAuth 2.1
-- server. Supabase nema sopstvene opsege (scopes): takav token ima ISTA prava
-- kao sesija aplikacije — mogao bi da čita i prepiše ceo `user_state`, briše
-- pretplate na obaveštenja, piše u zajednicu. Korisnik je odobrio samo
-- čitanje zdravstvenih podataka, i to kroz /api/mcp.
--
-- ŠTA DODAJE
-- `odbij_oauth_token()` kao PostgREST pre-request funkciju: svaki Data API
-- zahtev (tabele, pogledi, RPC) čiji JWT nosi `client_id` se odbija sa 403
-- pre nego što stigne do ijednog objekta. Tokeni aplikacije i service_role
-- nemaju `client_id` i prolaze kao do sada. /api/mcp čita `data->wellness`
-- service_role ključem, za korisnika kog je Supabase Auth potvrdio iz tokena.
--
-- ŠTA NE POKRIVA
-- Pre-request važi samo za Data API (ne Realtime ni Storage). Aplikacija ne
-- koristi ni jedno ni drugo (Storage nema kofe). /api/* putanje odbijaju isti
-- token u `requireUser`.
--
-- REDOSLED: ova migracija PRE uključivanja OAuth servera u Supabase-u. Pre
-- toga nijedan token nema `client_id`, pa je bez dejstva.
--
-- POVRATAK:
--   alter role authenticator reset pgrst.db_pre_request;
--   notify pgrst, 'reload config';
-- =====================================================================

create or replace function public.odbij_oauth_token()
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_klijent text;
begin
  -- Nečitljive tvrdnje NE obaraju zahtev: funkcija se izvršava na SVAKOM
  -- Data API zahtevu, pa bi greška ovde ugasila celu aplikaciju. RLS i dalje
  -- važi; ovde se samo prepoznaje OAuth token, a njegove tvrdnje su uvek JSON.
  begin
    v_klijent := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'client_id';
  exception when others then
    v_klijent := null;
  end;
  if v_klijent is not null then
    raise sqlstate 'PGRST' using
      message = json_build_object(
        'code', 'OAUTH_SAMO_MCP',
        'message', 'OAuth token (Claude konektor) nema pristup bazi; zdravstveni podaci se čitaju kroz /api/mcp.')::text,
      detail = json_build_object('status', 403)::text;
  end if;
end;
$$;

-- PostgREST je zove kao ulogu na koju je zahtev prebačen — sve tri moraju da smeju,
-- inače svaki zahtev te uloge pada.
revoke all on function public.odbij_oauth_token() from public;
grant execute on function public.odbij_oauth_token() to anon, authenticated, service_role;

-- `authenticator` je PostgREST-ova uloga: Supabase je ima, prazna baza ne mora.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    execute 'alter role authenticator set pgrst.db_pre_request = ''public.odbij_oauth_token''';
  end if;
end;
$$;

notify pgrst, 'reload config';
