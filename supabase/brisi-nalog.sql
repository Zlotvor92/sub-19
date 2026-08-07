-- =====================================================================
-- SUB-20 — BRISANJE NALOGA PO E-ADRESI
--
-- PUSTI OVAJ FAJL JEDNOM. Posle toga je brisanje jedan red:
--
--     select * from public.obrisi_naloge(array['neko@primer.com']);
--
-- Prva verzija ovog alata je bila cetiri koraka koje si lepio redom i sam
-- poredio ispise. Radila je, ali je za brisanje tri naloga trazila tri
-- kopiranja i budno oko — a budno oko je losa zastita. Sada proveru radi
-- funkcija, i radi je STROZE nego covek.
--
-- ZASTO POSTOJI, kad vec ima /api/delete-account
-- Ta putanja brise ISKLJUCIVO nalog onoga ko je poziva, i to je namerno: sa
-- service_role kljucem u ruci, citanje identifikatora iz zahteva znacilo bi
-- brisanje tudjeg naloga jednim poljem u JSON-u. Kad vlasnik treba da ukloni
-- TUDJ nalog (probni nalozi, zahtev stigao mejlom), ide ovuda.
--
-- ZASTO NE Supabase Dashboard -> Authentication -> Users -> Delete
-- Ostale tabele imaju `on delete cascade`, ali je `public.user_state`
-- pravljena rukom pre nego sto je sema usla u repozitorijum i njena definicija
-- ovde ne postoji. Bez cascade-a Dashboard daje jedan od dva losa ishoda,
-- oba potvrdjena na Postgresu 16.13:
--   strani kljuc BEZ cascade -> brisanje PUKNE ("violates foreign key
--     constraint user_state_user_id_fkey"), nalog ostane
--   BEZ stranog kljuca       -> brisanje prodje, ali red u user_state ostane
--     sa user_id-jem koji vise ne postoji. To se ne vidi kao greska.
-- Funkcija ispod radi ispravno u oba slucaja, jer brise eksplicitno.
--
-- SIGURNOSNA MREZA: ako ijedna adresa iz spiska ne postoji u bazi, funkcija
-- baca gresku i NISTA se ne brise — ni ostale adrese. Jedna transakcija, sve
-- ili nista. Zbog toga vise nema „pusti pregled pa uporedi ocima": greska u
-- kucanju se ne moze provuci.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Funkcija
-- ---------------------------------------------------------------------
create or replace function public.obrisi_naloge(p_adrese text[])
returns table (email text, tabela text, redova int)
language plpgsql
security definer                 -- mora: brise iz auth.users
set search_path = public, auth   -- bez ovoga je `security definer` funkcija
                                 -- ranjiva na podmetnutu semu u search_path-u
as $$
declare
  m       record;
  t       text;
  n       int;
  fali    text[];
  tabele  text[] := array[
    'user_state', 'push_pretplata', 'ai_posao',
    'api_usage', 'bug_report_usage', 'endpoint_usage'
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
end $$;

comment on function public.obrisi_naloge(text[]) is
  'Brise naloge po e-adresi zajedno sa svim podacima. Sve ili nista: nepostojeca adresa obara ceo poziv. Sme da je zove SAMO vlasnik iz SQL Editora.';


-- ---------------------------------------------------------------------
-- 2. Ko sme da je zove
-- ---------------------------------------------------------------------
-- KRITICNO. Supabase kroz PostgREST izlaze funkcije iz seme `public` kao
-- HTTP putanje (/rest/v1/rpc/obrisi_naloge). Bez ovog opoziva bi svako sa
-- anon kljucem — dakle svako ko otvori sajt — mogao da obrise bilo ciji nalog
-- jednim POST zahtevom. Funkcija je `security definer`, pa RLS tu ne pomaze.
revoke all on function public.obrisi_naloge(text[]) from public;
revoke all on function public.obrisi_naloge(text[]) from anon;
revoke all on function public.obrisi_naloge(text[]) from authenticated;
-- Ostaje dostupna vlasniku funkcije (postgres) i service_role kljucu, dakle
-- SQL Editoru. To je namerno jedini put.


-- =====================================================================
-- KAKO SE KORISTI, od sada pa nadalje
--
--   select * from public.obrisi_naloge(array[
--     'prva@primer.com',
--     'druga@primer.com'
--   ]);
--
-- Ispis je tabela: koja adresa, koja tabela, koliko redova. Poslednji red po
-- nalogu je „— NALOG OBRISAN —".
--
-- Ako neka adresa ne postoji, dobijas gresku sa spiskom tih adresa i NISTA se
-- ne brise. Ispravi kucanje i pusti ponovo.
--
-- NEPOVRATNO JE. Nema „undo", i podaci ne postoje nigde drugde osim ako ih je
-- korisnik sam izvezao kroz Podesavanja -> Backup.
-- =====================================================================
