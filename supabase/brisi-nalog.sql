-- =====================================================================
-- SUB-20 — BRISANJE NALOGA PO E-ADRESI (rucno, iz SQL Editora)
--
-- ZASTO POSTOJI, kad vec ima /api/delete-account
-- Ta putanja brise ISKLJUCIVO nalog onoga ko je poziva, i to je namerno: sa
-- service_role kljucem u ruci, citanje bilo kakvog identifikatora iz zahteva
-- znacilo bi brisanje tudjeg naloga jednim poljem u JSON-u. Kad vlasnik treba
-- da ukloni TUDJ nalog (probni nalozi, neko ko je trazio brisanje mejlom),
-- to ide ovuda.
--
-- ZASTO NE SAMO Supabase Dashboard -> Authentication -> Users -> Delete
-- Zato sto se ne zna da li `public.user_state` ima `on delete cascade`.
-- Ostale tabele ga imaju (v. supabase/*.sql), ali je `user_state` pravljena
-- rukom pre nego sto je sema usla u repozitorijum i njena definicija ovde ne
-- postoji. Bez cascade-a Dashboard daje jedan od dva losa ishoda, zavisno od
-- toga kako je tabela napravljena — oba potvrdjena na Postgresu 16.13:
--
--   strani kljuc BEZ cascade  -> brisanje PUKNE:
--     "update or delete on table users violates foreign key constraint
--      user_state_user_id_fkey" — nalog ostaje, a poruka ne kaze sta da radis
--   BEZ stranog kljuca        -> brisanje prodje, ali `user_state` zadrzi red
--     sa user_id-jem koji vise ne postoji. To se ne vidi kao greska.
--
-- KORAK 0 ispod kaze u kom si slucaju. KORAK 2 radi u oba.
--
-- KAKO SE PUSTA
-- Supabase -> SQL Editor. Pusti KORAK 0 i KORAK 1 prvo i procitaj ispis.
-- Tek onda KORAK 2. Ne lepi sve odjednom.
--
-- ⚠ SQL Editor pusta sve nalepljeno kao JEDAN batch, dakle jednu transakciju.
--   Ako nesto u nalepljenom tekstu pukne, ponistava se SVE — ukljucujuci i
--   brisanja iznad. Zato koraci idu odvojeno.
--
-- NEPOVRATNO JE. Nema „undo". Ako nisi siguran, KORAK 1 ti pokazuje tacno
-- sta ce nestati, bez ijedne izmene.
-- =====================================================================


-- ---------------------------------------------------------------------
-- KORAK 0 — ima li user_state cascade? (samo cita katalog, nista ne menja)
-- ---------------------------------------------------------------------
--   CASCADE            -> brisanje naloga samo pocisti i user_state
--   NO ACTION/RESTRICT -> brisanje naloga PUKNE dok red u user_state stoji
--   prazan rezultat    -> nema stranog kljuca; brisanje prodje i ostavi siroce
-- KORAK 2 radi ispravno u sva tri slucaja, pa je ovo samo za tvoje znanje.
select tc.constraint_name, rc.delete_rule
from information_schema.table_constraints tc
join information_schema.referential_constraints rc on rc.constraint_name = tc.constraint_name
where tc.table_schema = 'public' and tc.table_name = 'user_state' and tc.constraint_type = 'FOREIGN KEY';


-- ---------------------------------------------------------------------
-- KORAK 1 — PREGLED. Sta bi nestalo. Ne menja nista.
-- ---------------------------------------------------------------------
-- Upisi adrese OVDE. Velika/mala slova nisu bitna.
with adrese as (
  select unnest(array[
    'prva@primer.com',
    'druga@primer.com'
  ]) as e
),
mete as (
  select u.id, u.email, u.created_at, u.last_sign_in_at
  from auth.users u
  join adrese a on lower(u.email) = lower(a.e)
)
select
  m.email,
  m.created_at::date                                        as napravljen,
  m.last_sign_in_at::date                                   as poslednja_prijava,
  (select count(*) from public.user_state    s where s.user_id = m.id) as redova_stanja,
  (select count(*) from public.push_pretplata p where p.user_id = m.id) as uredjaja_sa_obavestenjima,
  (select count(*) from public.ai_posao       j where j.user_id = m.id) as ai_poslova
from mete m
order by m.email;

-- Ako je rezultat PRAZAN, adrese ne postoje u bazi — proveri kucanje pre nego
-- sto pomislis da je vec obrisano. Broj redova mora odgovarati broju adresa.


-- ---------------------------------------------------------------------
-- KORAK 2 — BRISANJE. Pusti tek kad si procitao KORAK 1.
-- ---------------------------------------------------------------------
-- Upisi ISTE adrese i ovde.
--
-- Redosled je bitan: podaci pa nalog, nikad obrnuto. Isti razlog kao u
-- api/delete-account.js — ako brisanje naloga prodje a podaci ostanu, redovi
-- vise nemaju vlasnika i niko ih ne moze ukloniti kroz aplikaciju.
--
-- `to_regclass` je tu jer sve tabele ne postoje u svakoj instalaciji:
-- endpoint_usage stize tek sa rate-limit.sql. Bez te provere bi skripta pukla
-- na tabeli koje nema i ponistila brisanja iznad.
do $$
declare
  adrese text[] := array[
    'prva@primer.com',
    'druga@primer.com'
  ];
  m record;
  t text;
  obrisano int;
begin
  for m in
    select u.id, u.email from auth.users u
    where lower(u.email) = any (select lower(x) from unnest(adrese) x)
  loop
    foreach t in array array[
      'user_state', 'push_pretplata', 'ai_posao',
      'api_usage', 'bug_report_usage', 'endpoint_usage'
    ] loop
      if to_regclass('public.' || t) is not null then
        execute format('delete from public.%I where user_id = $1', t) using m.id;
        get diagnostics obrisano = row_count;
        if obrisano > 0 then
          raise notice '  % : % redova', t, obrisano;
        end if;
      end if;
    end loop;

    delete from auth.users where id = m.id;
    raise notice 'OBRISAN NALOG: % (%)', m.email, m.id;
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- KORAK 3 — POTVRDA. Mora vratiti 0 redova.
-- ---------------------------------------------------------------------
select count(*) as jos_postoji
from auth.users
where lower(email) = any (array['prva@primer.com', 'druga@primer.com']);
