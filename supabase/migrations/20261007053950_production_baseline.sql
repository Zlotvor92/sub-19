-- Snapshot of the audited production public schema. Existing installations are only verified, never recreated.
-- Superadmin obrisi_naloge is installed only on an empty project; the existing function is not altered.
DO $baseline$
BEGIN
 IF to_regclass('public.user_state') IS NOT NULL THEN
  IF (SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' AND relname IN('user_state','api_usage','endpoint_usage','ai_posao','push_pretplata','bug_report_usage','zajednica_profil','zajednica_izazov','user_state_istorija','nalog_za_brisanje')) <> 10 THEN
   RAISE EXCEPTION 'Existing schema is incomplete; baseline adoption refused';
  END IF;
  RETURN;
 END IF;
 EXECUTE $schema$
CREATE TABLE IF NOT EXISTS public.user_state (
  user_id uuid DEFAULT auth.uid() NOT NULL,
  data jsonb NOT NULL,
  device_id text,
  app_version text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.api_usage (
  user_id uuid NOT NULL,
  day date DEFAULT CURRENT_DATE NOT NULL,
  calls integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS public.endpoint_usage (
  user_id uuid NOT NULL,
  dan date NOT NULL,
  endpoint text NOT NULL,
  broj integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ai_posao (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  stanje text DEFAULT 'radi'::text NOT NULL,
  tekst text,
  greska text,
  napravljen timestamp with time zone DEFAULT now() NOT NULL,
  izmenjen timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.push_pretplata (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  uredjaj text,
  najave jsonb DEFAULT '{}'::jsonb NOT NULL,
  napravljena timestamp with time zone DEFAULT now() NOT NULL,
  izmenjena timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.zajednica_profil (
  user_id uuid NOT NULL,
  vidljiv boolean DEFAULT false NOT NULL,
  nadimak text,
  avatar_url text,
  cilj text,
  trka_datum date,
  nedelja_br integer,
  nedelja_od integer,
  vdot numeric(4,1),
  vdot_pocetni numeric(4,1),
  test3k_sec integer,
  km_nedelja numeric(6,1),
  plan_pct integer,
  niz_dana integer,
  izazov_od integer,
  izazov_ura integer,
  znacke text[] DEFAULT '{}'::text[] NOT NULL,
  trcanja jsonb DEFAULT '[]'::jsonb NOT NULL,
  azurirano timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.bug_report_usage (
  user_id uuid NOT NULL,
  day date NOT NULL,
  calls integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS public.zajednica_izazov (
  id smallint DEFAULT 1 NOT NULL,
  tekst text NOT NULL,
  azurirano timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_state_istorija (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  data jsonb NOT NULL,
  app_version text,
  device_id text,
  napravljeno timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.nalog_za_brisanje (
  user_id uuid NOT NULL,
  email text,
  oznacio text NOT NULL,
  oznaceno timestamp with time zone DEFAULT now() NOT NULL,
  izvrsi_posle timestamp with time zone NOT NULL
);

ALTER TABLE public.ai_posao ADD CONSTRAINT "ai_posao_pkey" PRIMARY KEY (id);

ALTER TABLE public.ai_posao ADD CONSTRAINT "ai_posao_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.api_usage ADD CONSTRAINT "api_usage_pkey" PRIMARY KEY (user_id, day);

ALTER TABLE public.api_usage ADD CONSTRAINT "api_usage_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.bug_report_usage ADD CONSTRAINT "bug_report_usage_pkey" PRIMARY KEY (user_id, day);

ALTER TABLE public.bug_report_usage ADD CONSTRAINT "bug_report_usage_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.endpoint_usage ADD CONSTRAINT "endpoint_usage_pkey" PRIMARY KEY (user_id, dan, endpoint);

ALTER TABLE public.endpoint_usage ADD CONSTRAINT "endpoint_usage_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.nalog_za_brisanje ADD CONSTRAINT "nalog_za_brisanje_pkey" PRIMARY KEY (user_id);

ALTER TABLE public.nalog_za_brisanje ADD CONSTRAINT "nalog_za_brisanje_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.push_pretplata ADD CONSTRAINT "push_pretplata_endpoint_key" UNIQUE (endpoint);

ALTER TABLE public.push_pretplata ADD CONSTRAINT "push_pretplata_pkey" PRIMARY KEY (id);

ALTER TABLE public.push_pretplata ADD CONSTRAINT "push_pretplata_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_state ADD CONSTRAINT "user_state_pkey" PRIMARY KEY (user_id);

ALTER TABLE public.user_state ADD CONSTRAINT "user_state_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_state_istorija ADD CONSTRAINT "user_state_istorija_pkey" PRIMARY KEY (id);

ALTER TABLE public.user_state_istorija ADD CONSTRAINT "user_state_istorija_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.zajednica_izazov ADD CONSTRAINT "zajednica_izazov_id_check" CHECK ((id = 1));

ALTER TABLE public.zajednica_izazov ADD CONSTRAINT "zajednica_izazov_pkey" PRIMARY KEY (id);

ALTER TABLE public.zajednica_izazov ADD CONSTRAINT "zajednica_izazov_tekst_check" CHECK (((char_length(btrim(tekst)) >= 3) AND (char_length(btrim(tekst)) <= 160)));

ALTER TABLE public.zajednica_profil ADD CONSTRAINT "zajednica_profil_avatar_url_check" CHECK (((avatar_url IS NULL) OR (avatar_url ~ '^https://[a-zA-Z0-9.-]+/'::text)));

ALTER TABLE public.zajednica_profil ADD CONSTRAINT "zajednica_profil_cilj_check" CHECK (((cilj IS NULL) OR (cilj = ANY (ARRAY['5K'::text, '10K'::text, '21K'::text, '42K'::text]))));

ALTER TABLE public.zajednica_profil ADD CONSTRAINT "zajednica_profil_km_nedelja_check" CHECK (((km_nedelja IS NULL) OR ((km_nedelja >= (0)::numeric) AND (km_nedelja <= (300)::numeric))));

ALTER TABLE public.zajednica_profil ADD CONSTRAINT "zajednica_profil_nadimak_check" CHECK (((nadimak IS NULL) OR ((char_length(btrim(nadimak)) >= 2) AND (char_length(btrim(nadimak)) <= 24))));

ALTER TABLE public.zajednica_profil ADD CONSTRAINT "zajednica_profil_niz_dana_check" CHECK (((niz_dana IS NULL) OR ((niz_dana >= 0) AND (niz_dana <= 3650))));

ALTER TABLE public.zajednica_profil ADD CONSTRAINT "zajednica_profil_pkey" PRIMARY KEY (user_id);

ALTER TABLE public.zajednica_profil ADD CONSTRAINT "zajednica_profil_plan_pct_check" CHECK (((plan_pct IS NULL) OR ((plan_pct >= 0) AND (plan_pct <= 100))));

ALTER TABLE public.zajednica_profil ADD CONSTRAINT "zajednica_profil_test3k_sec_check" CHECK (((test3k_sec IS NULL) OR ((test3k_sec >= 480) AND (test3k_sec <= 2400))));

ALTER TABLE public.zajednica_profil ADD CONSTRAINT "zajednica_profil_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.zajednica_profil ADD CONSTRAINT "zajednica_profil_vdot_check" CHECK (((vdot IS NULL) OR ((vdot >= (20)::numeric) AND (vdot <= (85)::numeric))));

ALTER TABLE public.zajednica_profil ADD CONSTRAINT "zajednica_profil_znacke_check" CHECK (((array_length(znacke, 1) IS NULL) OR (array_length(znacke, 1) <= 20)));

ALTER TABLE public.zajednica_profil ADD CONSTRAINT "zp_izazov_ok" CHECK ((((izazov_od IS NULL) OR ((izazov_od >= 0) AND (izazov_od <= 21))) AND ((izazov_ura IS NULL) OR ((izazov_ura >= 0) AND (izazov_ura <= 21))) AND ((izazov_od IS NULL) OR (izazov_ura IS NULL) OR (izazov_ura <= izazov_od))));

ALTER TABLE public.zajednica_profil ADD CONSTRAINT "zp_nedelja_br_ok" CHECK (((nedelja_br IS NULL) OR ((nedelja_br >= 1) AND (nedelja_br <= 104))));

ALTER TABLE public.zajednica_profil ADD CONSTRAINT "zp_nedelja_od_ok" CHECK (((nedelja_od IS NULL) OR ((nedelja_od >= 1) AND (nedelja_od <= 104))));

ALTER TABLE public.zajednica_profil ADD CONSTRAINT "zp_trcanja_ok" CHECK (((jsonb_typeof(trcanja) = 'array'::text) AND (jsonb_array_length(trcanja) <= 8) AND (length((trcanja)::text) <= 2000)));

ALTER TABLE public.zajednica_profil ADD CONSTRAINT "zp_vdot_pocetni_ok" CHECK (((vdot_pocetni IS NULL) OR ((vdot_pocetni >= (20)::numeric) AND (vdot_pocetni <= (85)::numeric))));

CREATE OR REPLACE FUNCTION public.ai_posao_dodirni()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.izmenjen := now();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.ai_posao_nov()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if auth.uid() is not null then
    new.user_id := auth.uid();
    begin
      perform public.check_and_bump_endpoint('ai_posao', 60);
    exception
      -- MREŽA KOJA NEDOSTAJE NE SME DA OBORI ANALIZU.
      -- Namera je: ako brojač iz rate-limit.sql nije dostupan, preskoči ga —
      -- pravi limit je u kodu (/api/analyze) i i dalje radi. Prva verzija je
      -- hvatala SAMO `undefined_function`, što je uže od te namere: da tabela
      -- `endpoint_usage` ikad nedostaje dok funkcija postoji, greška bi bila
      -- `undefined_table`, propala bi kroz handler i oborila UPIS POSLA —
      -- dakle celu AI analizu, i to tiho, tek kad neko klikne.
      -- DAILY_LIMIT_EXCEEDED (P0001) se NAMERNO ne hvata: to je backstop koji
      -- treba da radi. `when others` bi ga progutao i mreža ne bi postojala.
      when undefined_function or undefined_table or insufficient_privilege then null;
    end;
  end if;
  new.stanje := 'radi';
  new.tekst  := null;
  new.greska := null;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.ai_posao_prelaz()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.user_id <> old.user_id then
    raise exception 'AI_POSAO_TUDJI' using errcode = '42501';
  end if;

  if new.stanje is distinct from old.stanje then
    -- Nazad na 'radi' ne vodi nijedan ispravan put. To je bio ceo napad.
    if new.stanje = 'radi' then
      raise exception 'AI_POSAO_PONOVO' using errcode = '22023';
    end if;
    if not (
      (old.stanje = 'radi'   and new.stanje = 'u_toku') or
      (old.stanje = 'u_toku' and new.stanje in ('gotovo', 'greska'))
    ) then
      raise exception 'AI_POSAO_PRELAZ' using errcode = '22023';
    end if;
  end if;

  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.check_and_bump_api_usage(p_limit integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user uuid := auth.uid();
  v_dan  date := (now() at time zone 'Europe/Belgrade')::date;
  v_broj integer;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100000 then
    raise exception 'BAD_LIMIT' using errcode = '22023';
  end if;

  insert into public.api_usage as u (user_id, day, calls)
  values (v_user, v_dan, 1)
  on conflict (user_id, day)
  do update set calls = u.calls + 1
  returning u.calls into v_broj;

  if v_broj > p_limit then
    raise exception 'DAILY_LIMIT_EXCEEDED' using errcode = 'P0001';
  end if;

  -- Čišćenje starih redova ovog korisnika. `daily-report` prikazuje SAMO
  -- poslednji dan sa pozivima, pa dublja istorija nema čitaoca. Devedeset
  -- dana je i dalje velikodušno.
  delete from public.api_usage where user_id = v_user and day < v_dan - 90;

  return v_broj;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.check_and_bump_bug_usage(p_limit integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user uuid := auth.uid();
  v_dan  date := (now() at time zone 'Europe/Belgrade')::date;
  v_broj integer;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100000 then
    raise exception 'BAD_LIMIT' using errcode = '22023';
  end if;

  insert into public.bug_report_usage as u (user_id, day, calls)
  values (v_user, v_dan, 1)
  on conflict (user_id, day)
  do update set calls = u.calls + 1
  returning u.calls into v_broj;

  if v_broj > p_limit then
    raise exception 'DAILY_LIMIT_EXCEEDED' using errcode = 'P0001';
  end if;

  delete from public.bug_report_usage where user_id = v_user and day < v_dan - 90;

  return v_broj;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.check_and_bump_endpoint(p_endpoint text, p_limit integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user uuid := auth.uid();
  -- DAN JE KORISNIKOV DAN, NE UTC DAN.
  -- Sa `utc` se brojač resetovao u 02:00 po lokalnom vremenu (01:00 zimi) —
  -- dakle usred noći koja pripada prethodnom danu. Ko je uveče potrošio limit
  -- dobijao je „pokušaj ponovo sutra", a „sutra" je stizalo tek posle dva
  -- ujutru; ko je trčao rano, delio je limit sa prethodnim danom. Aplikacija
  -- je jedina u jednoj vremenskoj zoni (v. danasBeograd u api/push.js) — pa
  -- neka i brojač bude u njoj.
  v_dan  date := (now() at time zone 'Europe/Belgrade')::date;
  v_broj integer;
begin
  -- Bez prijave nema brojanja. `auth.uid()` je null kad se pozove sa anon
  -- ključem bez korisnikovog tokena — to nikad ne sme da prođe kao "0 poziva".
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  -- NAZIV MORA BITI SA SPISKA, NE SAMO ISPRAVNOG OBLIKA.
  --
  -- Ranije je ovde stajala provera azbuke (`^[a-z0-9_-]{1,40}$`) uz komentar da
  -- bez nje „pozivalac sa izmišljenim nazivom svaki put dobija NOV red". Tačno —
  -- samo što provera azbuke to nije sprečavala: slučajan string je i dalje
  -- ispravnog oblika. Funkcija je izložena kroz PostgREST i `grant execute … to
  -- authenticated`, anon ključ je javan po dizajnu, a naziv endpointa je deo
  -- primarnog ključa — pa je jedan prijavljen korisnik mogao da napravi
  -- proizvoljno mnogo redova u tabeli koju niko ne može ni da pročita.
  -- Mereno: 5000 poziva sa `x1`…`x5000` daje 5000 redova i 744 kB, bez ijednog
  -- izuzetka. Kad se baza napuni, prestaje da radi SVIMA.
  --
  -- `delete … where dan < v_dan - 30` niže to ne krati: briše po DANU, a u istom
  -- danu ne briše ništa.
  --
  -- Nazive bira SERVERSKI KOD, ne korisnik, pa je spisak i tačan opis stvarnosti.
  -- Kad se doda nov brojač, dodaje se i ovde — a dok se ne doda, poziv pada sa
  -- BAD_ENDPOINT, dakle glasno, umesto da tiho pravi redove.
  if p_endpoint is null or p_endpoint not in (
      'wellness', 'activities', 'workouts', 'zone',  -- api/icu.js
      'analyze_citaj', 'ai_posao',            -- api/analyze.js i okidač
      'strava_token',                         -- api/auth.js
      'icu_oauth',                            -- api/icu-oauth.js
      'push_proba',                           -- api/push.js
      'admin_ban', 'admin_obrisi', 'admin_2fa' -- api/broadcast.js
    ) then
    raise exception 'BAD_ENDPOINT' using errcode = '22023';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 100000 then
    raise exception 'BAD_LIMIT' using errcode = '22023';
  end if;

  insert into public.endpoint_usage as u (user_id, dan, endpoint, broj)
  values (v_user, v_dan, p_endpoint, 1)
  on conflict (user_id, dan, endpoint)
  do update set broj = u.broj + 1
  returning u.broj into v_broj;

  if v_broj > p_limit then
    raise exception 'DAILY_LIMIT_EXCEEDED' using errcode = 'P0001';
  end if;

  -- Čišćenje starih redova ovog korisnika. Ide OVDE, a ne kao zakazan posao,
  -- da tabela ostane ograničena bez pg_cron-a i bez ijednog podešavanja.
  -- Jeftino je: pogađa prefiks primarnog ključa i briše nekoliko redova.
  delete from public.endpoint_usage
   where user_id = v_user and dan < v_dan - 30;

  return v_broj;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.obrisi_naloge(p_adrese text[])
 RETURNS TABLE(email text, tabela text, redova integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  m       record;
  t       text;
  n       int;
  fali    text[];
  tabele  text[] := array[
    'user_state', 'push_pretplata', 'ai_posao',
    'api_usage', 'bug_report_usage', 'endpoint_usage',
    'zajednica_profil', 'user_state_istorija'
  ];
begin
  if p_adrese is null or array_length(p_adrese, 1) is null then
    raise exception 'Nije data nijedna adresa.';
  end if;

  -- SVE ILI NISTA. Adresa koja ne postoji je skoro uvek greska u kucanju, a
  -- ne „vec je obrisana" — pa je bezbednije stati nego obrisati ostale i
  -- ostaviti coveka da nagadja sta je proslo.
  select array_agg(a)
    into fali
  from unnest(p_adrese) a
  where not exists (select 1 from auth.users u where lower(u.email) = lower(a));

  if fali is not null then
    raise exception 'Ove adrese ne postoje u bazi: %. Nista nije obrisano.',
      array_to_string(fali, ', ');
  end if;

  for m in
    select u.id, u.email from auth.users u
    where lower(u.email) = any (select lower(x) from unnest(p_adrese) x)
  loop
    foreach t in array tabele loop
      -- Tabele ne postoje u svakoj instalaciji: `endpoint_usage` stize tek sa
      -- rate-limit.sql. Bez ove provere bi funkcija pukla na tabeli koje nema.
      if to_regclass('public.' || t) is not null then
        execute format('delete from public.%I where user_id = $1', t) using m.id;
        get diagnostics n = row_count;
        if n > 0 then
          email := m.email; tabela := t; redova := n; return next;
        end if;
      end if;
    end loop;

    -- Nalog TEK NA KRAJU. Obrnut redosled je najgori ishod: covek izgubi
    -- pristup, podaci ostanu, i vise ne moze ni da se prijavi da pokusa opet.
    delete from auth.users where id = m.id;
    email := m.email; tabela := '— NALOG OBRISAN —'; redova := 1; return next;
  end loop;
end $function$
;

CREATE OR REPLACE FUNCTION public.push_pretplata_dodirni()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.izmenjena := now();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.user_state_touch()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  NEW.updated_at := now();
  return NEW;
end $function$
;

CREATE OR REPLACE FUNCTION public.user_state_zapamti()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  poslednja timestamptz;
begin
  begin
    -- Bez izmene sadržaja nema šta da se pamti (npr. upis istog stanja sa
    -- drugog uređaja).
    if OLD.data is not distinct from NEW.data then
      return NEW;
    end if;

    select max(napravljeno) into poslednja
      from public.user_state_istorija where user_id = OLD.user_id;

    if poslednja is null or poslednja < now() - interval '1 hour' then
      insert into public.user_state_istorija (user_id, data, app_version, device_id)
        values (OLD.user_id, OLD.data, OLD.app_version, OLD.device_id);

      -- Zadrži najnovijih 40. `id` raste monotono, pa je poređenje po njemu
      -- pouzdanije od poređenja po vremenu (dva zapisa u istoj sekundi).
      delete from public.user_state_istorija
       where user_id = OLD.user_id
         and id not in (
           select id from public.user_state_istorija
            where user_id = OLD.user_id
            order by id desc limit 40);
    end if;
  exception when others then
    -- Namerno nemo: v. objašnjenje iznad. Trag ostaje u logu baze.
    raise warning '[istorija] verzija nije sačuvana za %: %', OLD.user_id, sqlerrm;
  end;
  return NEW;
end $function$
;

CREATE OR REPLACE FUNCTION public.zajednica_profil_dodirni()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.azurirano := now();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.zajednica_vidljiv_ja()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (select p.vidljiv from public.zajednica_profil p where p.user_id = auth.uid()),
    false)
$function$
;

ALTER TABLE public.user_state ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.endpoint_usage ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.zajednica_profil ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.bug_report_usage ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_posao ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.push_pretplata ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.zajednica_izazov ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_state_istorija ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.nalog_za_brisanje ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_usage_own" ON public.api_usage AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));

CREATE POLICY "zajednica_profil_citaj" ON public.zajednica_profil AS PERMISSIVE FOR SELECT TO public USING (((auth.uid() = user_id) OR (vidljiv AND zajednica_vidljiv_ja())));

CREATE POLICY "zajednica_profil_pisi" ON public.zajednica_profil AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "zajednica_profil_menjaj" ON public.zajednica_profil AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "zajednica_profil_brisi" ON public.zajednica_profil AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));

CREATE POLICY "zajednica_izazov_citaj" ON public.zajednica_izazov AS PERMISSIVE FOR SELECT TO public USING (true);

CREATE POLICY "user_state_istorija_citaj" ON public.user_state_istorija AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));

CREATE POLICY "ai_posao_citaj" ON public.ai_posao AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));

CREATE POLICY "ai_posao_pisi" ON public.ai_posao AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "ai_posao_menjaj" ON public.ai_posao AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "ai_posao_brisi" ON public.ai_posao AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));

CREATE POLICY "push_pretplata_citaj" ON public.push_pretplata AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));

CREATE POLICY "push_pretplata_pisi" ON public.push_pretplata AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "push_pretplata_menjaj" ON public.push_pretplata AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "push_pretplata_brisi" ON public.push_pretplata AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));

CREATE POLICY "user_state_citaj" ON public.user_state AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));

CREATE POLICY "user_state_upisi" ON public.user_state AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "user_state_azuriraj" ON public.user_state AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "user_state_obrisi" ON public.user_state AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));

CREATE TRIGGER zajednica_profil_dodirni_trg BEFORE INSERT OR UPDATE ON public.zajednica_profil FOR EACH ROW EXECUTE FUNCTION zajednica_profil_dodirni();

CREATE TRIGGER user_state_zapamti_trg BEFORE UPDATE ON public.user_state FOR EACH ROW EXECUTE FUNCTION user_state_zapamti();

CREATE TRIGGER ai_posao_dodirni_trg BEFORE UPDATE ON public.ai_posao FOR EACH ROW EXECUTE FUNCTION ai_posao_dodirni();

CREATE TRIGGER ai_posao_prelaz_trg BEFORE UPDATE ON public.ai_posao FOR EACH ROW EXECUTE FUNCTION ai_posao_prelaz();

CREATE TRIGGER ai_posao_nov_trg BEFORE INSERT ON public.ai_posao FOR EACH ROW EXECUTE FUNCTION ai_posao_nov();

CREATE TRIGGER push_pretplata_dodirni_trg BEFORE UPDATE ON public.push_pretplata FOR EACH ROW EXECUTE FUNCTION push_pretplata_dodirni();

CREATE TRIGGER user_state_touch_trg BEFORE INSERT OR UPDATE ON public.user_state FOR EACH ROW EXECUTE FUNCTION user_state_touch();

CREATE INDEX zajednica_profil_vidljiv_idx ON public.zajednica_profil USING btree (vidljiv) WHERE vidljiv;

CREATE INDEX ai_posao_stari_idx ON public.ai_posao USING btree (user_id, napravljen);

CREATE INDEX push_pretplata_korisnik_idx ON public.push_pretplata USING btree (user_id);

CREATE INDEX user_state_istorija_idx ON public.user_state_istorija USING btree (user_id, napravljeno DESC);

CREATE INDEX nalog_za_brisanje_rok_idx ON public.nalog_za_brisanje USING btree (izvrsi_posle);

CREATE VIEW public.app_stats WITH(security_invoker=true) AS  SELECT count(*) AS korisnika,
    count(*) FILTER (WHERE updated_at > (now() - '24:00:00'::interval)) AS aktivnih_24h,
    count(*) FILTER (WHERE updated_at > (now() - '7 days'::interval)) AS aktivnih_7d,
    count(*) FILTER (WHERE updated_at > (now() - '30 days'::interval)) AS aktivnih_30d,
    count(*) FILTER (WHERE created_at > (now() - '7 days'::interval)) AS novih_7d,
    round(avg(( SELECT count(*) AS count
           FROM jsonb_object_keys(COALESCE(user_state.data -> 'log'::text, '{}'::jsonb)) jsonb_object_keys(jsonb_object_keys)))) AS prosek_treninga,
    round(avg(jsonb_array_length(COALESCE(data -> 'vdotLog'::text, '[]'::jsonb)))) AS prosek_vdot_unosa,
    count(*) FILTER (WHERE (data -> 'genPlan'::text) IS NOT NULL AND (data -> 'genPlan'::text) <> 'null'::jsonb) AS sa_generisanim_planom
   FROM user_state;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.app_stats TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.user_state TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.user_state TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.api_usage TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.endpoint_usage TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.zajednica_profil TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.zajednica_profil TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.bug_report_usage TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.ai_posao TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.ai_posao TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.push_pretplata TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.push_pretplata TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.zajednica_izazov TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.zajednica_izazov TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.user_state_istorija TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.user_state_istorija TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.nalog_za_brisanje TO service_role;

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

REVOKE ALL ON FUNCTION public.obrisi_naloge(text[]) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.obrisi_naloge(text[]) TO service_role;
$schema$;
END $baseline$;
