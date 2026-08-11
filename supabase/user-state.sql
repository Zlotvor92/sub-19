-- =====================================================================
-- SUB-20 — public.user_state
--
-- ZAŠTO OVAJ FAJL POSTOJI TEK SADA
-- Ova tabela nosi CELO stanje korisnika: plan, dnevnik treninga, beleške,
-- HRV, puls u miru, san, težinu, mapu bolova, istoriju forme. Nastala je
-- rukom kroz Supabase → SQL Editor, pre nego što je ovaj folder uopšte
-- postojao — pa je bila jedina tabela čije politike NISU bile ni u jednom
-- fajlu u repozitorijumu. Posledica nije bila rupa nego NEVIDLJIVOST: nije
-- postojalo ništa sa čim bi se stvarne politike uporedile, i `provera.sql`
-- ju je zato mogao samo da prijavi kao „RLS uključen · OK" — i za politiku
-- `using (auth.uid() = user_id)` i za politiku `using (true)`.
--
-- OVO JE IDEMPOTENTNO I NAMERNO NE DIRA PODATKE.
-- `create table if not exists` neće prepisati zatečenu tabelu; kolone se
-- dodaju samo ako ih nema. Politike se pišu iznova (`drop policy if exists`
-- pa `create policy`) — to je i svrha: da izraz u bazi bude tačno onaj koji
-- stoji ovde, a ne onaj koji se u nekom trenutku zatekao.
--
-- PRE PUŠTANJA SNIMI ZATEČENO STANJE, da postoji čemu da se vratiš:
--   select policyname, cmd, qual, with_check
--     from pg_policies where schemaname='public' and tablename='user_state';
--
-- Posle puštanja obavezno `provera.sql`.
-- =====================================================================

-- 1. TABELA
-- Oblik je izveden iz onoga što kod stvarno šalje i čita:
--   upis   (app.js, sbPush)  user_id, data, device_id, app_version
--   čitanje(app.js, sbPull)  data, updated_at
--   čitanje(app.js, sbRemoteAt) updated_at, device_id
--   čitanje(api/daily-report) user_id, data, updated_at   (service_role)
create table if not exists public.user_state (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  data        jsonb       not null default '{}'::jsonb,
  device_id   text,
  app_version text,
  updated_at  timestamptz not null default now(),
  -- `created_at` NIJE UKRAS: `app_stats` iz njega racuna `novih_7d`
  -- (v. supabase/app-stats.sql). Kolona je u bazi postojala godinama, a ovaj
  -- fajl je nije opisivao — pa bi tabela napravljena iz repozitorijuma bila
  -- tiho nepotpuna, a pogled nad njom ne bi mogao ni da se napravi.
  -- Isto razilazenje kao i sam `app_stats`, samo jedan sloj dublje; nadjeno
  -- tek kad je njegova definicija prepisana iz zive baze.
  created_at  timestamptz not null default now()
);

-- Kolone koje su dodate kasnije — na zatečenoj tabeli ih možda nema.
alter table public.user_state add column if not exists device_id   text;
alter table public.user_state add column if not exists app_version text;
alter table public.user_state add column if not exists updated_at  timestamptz not null default now();
-- Na zatecenoj tabeli ovo je bez dejstva (kolona vec postoji); postoji zbog
-- svakog buduceg okruzenja koje se pravi IZ OVOG FAJLA. v. `app_stats`.
alter table public.user_state add column if not exists created_at  timestamptz not null default now();

-- 1a. `on delete cascade` NA ZATEČENOJ TABELI.
--
-- MOJ PROPUST, iste vrste kao kolone iznad: `on delete cascade` je stajalo samo
-- unutar `create table if not exists`, a to nad tabelom koja već postoji ne radi
-- ništa. Kolone sam popravio kroz `add column if not exists`, ograničenje nisam.
--
-- Zašto je bitno: bez cascade-a brisanje naloga kroz Supabase Dashboard daje
-- jedan od dva loša ishoda (oba potvrđena na Postgresu 16.13):
--   strani ključ BEZ cascade -> brisanje PUKNE i nalog ostane
--   BEZ stranog ključa       -> brisanje prođe, ali red u user_state ostane sa
--                               user_id-jem koji više ne postoji, i to se ne
--                               vidi kao greška
-- `api/delete-account.js` i `obrisi_naloge` brišu eksplicitno, pa njima cascade
-- ne treba — ali Dashboard je put kojim se ide kad nešto krene naopako.
--
-- Idempotentno: ako ograničenje već ima cascade, ništa se ne dešava.
do $$
declare v_ime text; v_pravilo text;
begin
  select con.conname, con.confdeltype into v_ime, v_pravilo
    from pg_constraint con
   where con.conrelid = 'public.user_state'::regclass
     and con.contype = 'f'
     and con.confrelid = 'auth.users'::regclass
   limit 1;

  if v_ime is null then
    alter table public.user_state
      add constraint user_state_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
    raise notice 'user_state: dodat strani ključ sa on delete cascade';
  elsif v_pravilo <> 'c' then
    execute format('alter table public.user_state drop constraint %I', v_ime);
    alter table public.user_state
      add constraint user_state_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
    raise notice 'user_state: strani ključ % zamenjen verzijom sa on delete cascade', v_ime;
  else
    raise notice 'user_state: strani ključ već ima on delete cascade';
  end if;
end $$;

comment on table public.user_state is
  'Celo stanje jednog korisnika, jedan red po nalogu. Prepisuje se u mestu; prethodne verzije čuva user_state_istorija (v. istorija.sql).';

-- 2. `updated_at` MORA da postavlja baza, ne klijent.
-- `sbRemoteAt` po njemu odlučuje čija je kopija novija i time koja izmena
-- preživljava. Da ga šalje klijent, uređaj sa satom u budućnosti bi zauvek
-- „pobeđivao" i tiho gazio izmene sa svih ostalih uređaja.
create or replace function public.user_state_touch()
returns trigger language plpgsql as $$
begin
  NEW.updated_at := now();
  return NEW;
end $$;

drop trigger if exists user_state_touch_trg on public.user_state;
create trigger user_state_touch_trg
  before insert or update on public.user_state
  for each row execute function public.user_state_touch();

-- 2a. ZATEČEN OKIDAČ KOJI RADI ISTO.
--
-- `inventar.sql` je u bazi našao okidač `user_state_touch` i funkciju
-- `touch_updated_at` kojih nema ni u jednom fajlu — nastali rukom, pre ovog
-- foldera. Moj okidač iznad je time postao DRUGI koji radi istu stvar.
--
-- NE BRIŠE SE NAPAMET. Ime kaže „touch", ali ime nije dokaz; funkcija je mogla
-- da radi i nešto više, i to bi se izgubilo bez traga. Zato se briše samo ako
-- joj TELO stvarno ne radi ništa osim što postavlja `updated_at` — to Postgres
-- može sam da proveri, pa nema pogađanja.
--
-- Funkcija se NE dira: možda visi i na drugim tabelama koje ovaj fajl ne
-- poznaje. Ostaje, i `inventar.sql` će je prijavljivati dok se ne opiše ili ne
-- ukloni — što je tačno ono što treba da radi.
do $$
declare r record; v_telo text;
begin
  for r in
    select t.tgname, p.proname, pg_get_functiondef(p.oid) as def
      from pg_trigger t
      join pg_proc p on p.oid = t.tgfoid
     where t.tgrelid = 'public.user_state'::regclass
       and not t.tgisinternal
       and t.tgname <> 'user_state_touch_trg'
       and t.tgname <> 'user_state_zapamti_trg'
  loop
    v_telo := lower(regexp_replace(r.def, '\s+', ' ', 'g'));
    if v_telo ~ 'new\.updated_at\s*(:=|=)\s*now\(\)'
       and v_telo !~ 'insert into|update |delete from|perform |raise exception'
    then
      execute format('drop trigger %I on public.user_state', r.tgname);
      raise notice 'uklonjen dvojnik: okidač % (funkcija %) je radio isto što i user_state_touch_trg', r.tgname, r.proname;
    else
      raise warning 'okidač % (funkcija %) NIJE uklonjen — telo radi i nešto drugo, pogledaj ga rukom', r.tgname, r.proname;
    end if;
  end loop;
end $$;

-- 2b. FUNKCIJA KOJA JE OSTALA BEZ POSLA.
--
-- Kad se dvojnik okidača ukloni (2a), funkcija koju je zvao ostaje u bazi bez
-- ijednog korisnika. `inventar.sql` je i dalje prijavljuje kao NEPOZNATO, i s
-- pravom: postoji, a nijedan fajl je ne opisuje.
--
-- Briše se SAMO ako je stvarno niko ne koristi — a to Postgres zna sam.
-- Gleda se `pg_depend`, ne spisak okidača: funkcija može da visi i na
-- podrazumevanoj vrednosti kolone, u pogledu ili u ograničenju, i nijedno od
-- toga se ne vidi kroz `pg_trigger`. Ako se bilo šta oslanja na nju, ostaje i
-- javi se — bolje da inventar ima jedan red viška nego da nešto tiho pukne.
--
-- Imenom se ne bira šta se briše: uzimaju se sve funkcije u `public` koje
-- nijedan fajl u supabase/ ne pravi, koje vraćaju `trigger`, i koje niko ne
-- koristi. Zato ovo radi i za sledeći takav ostatak, ne samo za ovaj jedan.
do $$
declare r record; v_zavisi int;
begin
  for r in
    select p.oid, p.proname
      from pg_proc p
      join pg_type t on t.oid = p.prorettype
     where p.pronamespace = 'public'::regnamespace
       and t.typname = 'trigger'
       and p.proname not in (
         'user_state_touch','user_state_zapamti','ai_posao_dodirni','ai_posao_nov',
         'ai_posao_prelaz','push_pretplata_dodirni','zajednica_profil_dodirni')
  loop
    select count(*) into v_zavisi
      from pg_depend d
     where d.refobjid = r.oid
       and d.deptype <> 'i'
       and d.classid <> 'pg_proc'::regclass;

    if v_zavisi = 0 then
      execute format('drop function public.%I()', r.proname);
      raise notice 'uklonjena funkcija bez posla: % (nijedan okidač, pogled ni podrazumevana vrednost je ne koristi)', r.proname;
    else
      raise warning 'funkcija % NIJE uklonjena — nešto se još oslanja na nju (% zavisnosti)', r.proname, v_zavisi;
    end if;
  end loop;
end $$;

-- 3. RLS
alter table public.user_state enable row level security;

-- `anon` nema šta da traži ovde. RLS štiti redove, ali `grant` je sloj ispod
-- njega: bez ovoga javni anon ključ dobija pristup tabeli i sve visi na tome
-- da je politika napisana ispravno.
revoke all on table public.user_state from anon;
grant select, insert, update, delete on table public.user_state to authenticated;

-- 3a. STARA IMENA SE UKLANJAJU.
-- Tabela je nastala rukom, pre ovog foldera, pa se kroz vreme nakupilo TRI
-- kompleta politika sa istim izrazom: `user_state_select_own`, `us_sel` i
-- `user_state_citaj` — i tako za sve četiri radnje. Nije bila rupa (permisivne
-- politike se sabiraju kao ILI, a sve tri su `auth.uid() = user_id`, pa ništa
-- nije bilo šire), ali jeste tačno ono stanje zbog kog ovaj fajl i postoji:
-- niko ne može da kaže šta je u bazi dok ne pogleda, a kad ih je devet, pogled
-- ne pomaže. Jedna pogrešna među devet se ne primeti.
--
-- Uklanjaju se PRE nego što se nove naprave, da ni u jednom trenutku ne ostane
-- tabela bez ijedne politike (a sa uključenim RLS-om to znači: niko ne prolazi).
-- Postgres ovo radi u jednoj transakciji, pa prekid na pola ne ostavlja rupu.
drop policy if exists user_state_select_own on public.user_state;
drop policy if exists user_state_insert_own on public.user_state;
drop policy if exists user_state_update_own on public.user_state;
drop policy if exists user_state_delete_own on public.user_state;
drop policy if exists us_sel on public.user_state;
drop policy if exists us_ins on public.user_state;
drop policy if exists us_upd on public.user_state;
drop policy if exists us_del on public.user_state;

-- SVAKA politika veže red za `auth.uid()`. Nema nijednog izuzetka: za razliku
-- od `zajednica_profil`, ovde ne postoji ništa što bi drugi smeo da vidi.
drop policy if exists user_state_citaj on public.user_state;
create policy user_state_citaj on public.user_state
  for select using (auth.uid() = user_id);

drop policy if exists user_state_upisi on public.user_state;
create policy user_state_upisi on public.user_state
  for insert with check (auth.uid() = user_id);

-- `using` I `with check`: bez `with check` bi izmena mogla da prepiše
-- `user_id` na tuđi i time preda red drugome.
drop policy if exists user_state_azuriraj on public.user_state;
create policy user_state_azuriraj on public.user_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Brisanje sopstvenog reda je deo brisanja naloga (v. api/delete-account.js).
drop policy if exists user_state_obrisi on public.user_state;
create policy user_state_obrisi on public.user_state
  for delete using (auth.uid() = user_id);

-- 4. ISPIS STANJA — POSLEDNJA NAREDBA U FAJLU
--
-- ZAŠTO NIJE DOVOLJNO `raise notice`.
-- Blokovi iznad javljaju šta su uradili preko `raise notice` / `raise warning`.
-- Supabase SQL Editor te poruke NE PRIKAZUJE — vrati samo „Success. No rows
-- returned". Ceo fajl je DDL, pa je to tačan odgovor, ali ne kaže ništa: isto
-- piše i kad je dvojnik uklonjen i kad je preskočen uz upozorenje.
--
-- Zato fajl završava upitom KOJI VRAĆA REDOVE. Posle njega „no rows" više nije
-- mogući ishod — ono što se dogodilo vidi se u tabeli ispod.
--
-- ŠTA SE OČEKUJE:
--   politika        četiri reda, svaki sa auth.uid() u izrazu
--   okidač          user_state_touch_trg i user_state_zapamti_trg, ništa treće
--   strani ključ    on delete cascade
--   anon            nema pristup
--   ostatak         nijedan red (funkcija bez posla više nema)
select 'politika' as stavka, policyname as ime,
       cmd || ' · ' || coalesce(qual, with_check, '—') as detalj
  from pg_policies where schemaname = 'public' and tablename = 'user_state'

union all
select 'okidač', tgname, case when tgenabled = 'O' then 'aktivan' else 'ISKLJUČEN' end
  from pg_trigger where tgrelid = 'public.user_state'::regclass and not tgisinternal

union all
select 'strani ključ', conname,
       case confdeltype when 'c' then 'on delete cascade'
                        else 'NIJE cascade — brisanje naloga kroz Dashboard neće proći' end
  from pg_constraint where conrelid = 'public.user_state'::regclass and contype = 'f'

union all
select 'anon', 'grant nad user_state',
       coalesce((select string_agg(distinct privilege_type, ', ')
                   from information_schema.role_table_grants
                  where grantee = 'anon' and table_schema = 'public' and table_name = 'user_state'),
                'nema pristup — ispravno')

union all
-- Ostatak koji čišćenje NIJE smelo da ukloni. Prazno je dobro.
select 'ostatak', p.proname,
       'funkcija okidača koju nijedan fajl ne pravi — nešto se još oslanja na nju'
  from pg_proc p join pg_type t on t.oid = p.prorettype
 where p.pronamespace = 'public'::regnamespace and t.typname = 'trigger'
   and p.proname not in (
     'user_state_touch','user_state_zapamti','ai_posao_dodirni','ai_posao_nov',
     'ai_posao_prelaz','push_pretplata_dodirni','zajednica_profil_dodirni')

order by 1, 2;
