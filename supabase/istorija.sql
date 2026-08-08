-- =====================================================================
-- SUB-20 — ISTORIJA VERZIJA STANJA
--
-- ZAŠTO POSTOJI
-- `user_state` je JEDAN RED po korisniku koji se prepisuje u mestu. To znači
-- da server verno prenosi i grešku: obrisan unos, pokvareno stanje ili
-- pogrešan izbor u traci sukoba stignu na server za nekoliko sekundi i stara
-- vrednost više ne postoji nigde. Server je do sada bio OGLEDALO, ne arhiva —
-- štitio je od gubitka telefona, ali ne od gubitka podataka.
--
-- Zbog toga je backup fajl ostajao neophodan. Ovaj fajl to zatvara: pre svake
-- izmene se sačuva prethodna verzija, pa se u aplikaciji može vratiti unazad.
--
-- KOLIKO KOŠTA
-- Mereno na stanju sa punim planom, godinom jutarnjih merenja, 120 zapisa
-- forme i beleškama: 37 KB sirovo. `jsonb` se u Postgresu čuva kompresovan,
-- pa je stvarni zapis znatno manji. Uz najviše 40 verzija po korisniku, to je
-- reda pola megabajta za NAJTEŽEG korisnika.
--
-- KAKO SE PUŠTA
-- Supabase → SQL Editor → nalepi CEO ovaj fajl → Run.
-- Puštanje dvaput je bezbedno.
--
-- ŠTA NE DIRA
-- `user_state` zadržava tačno onakav oblik kakav ima — ovaj fajl mu samo
-- kači okidač. Nijedan postojeći red se ne menja.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------------------
create table if not exists public.user_state_istorija (
  id          bigint generated always as identity primary key,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  data        jsonb       not null,
  app_version text,
  device_id   text,
  napravljeno timestamptz not null default now()
);

comment on table public.user_state_istorija is
  'Prethodne verzije user_state.data. Piše ISKLJUČIVO okidač; korisnik sme samo da čita svoje.';

-- Spisak se uvek čita za jednog korisnika, najnovije prvo.
create index if not exists user_state_istorija_idx
  on public.user_state_istorija (user_id, napravljeno desc);


-- ---------------------------------------------------------------------
-- 2. Okidač
--
-- ČUVA STARU VREDNOST, NE NOVU. Kad izmena stigne, `OLD.data` je poslednje
-- stanje koje je bilo ISPRAVNO sa stanovišta onoga ko se vraća unazad.
--
-- NAJVIŠE JEDNA VERZIJA NA SAT. Aplikacija gura izmene četiri sekunde posle
-- svakog dodira, pa bi bez ovoga jedno popodne rada napravilo pedeset verzija
-- — a sve iz istog popodneva. Ovako spisak pokriva NEDELJE, što je vreme u
-- kom se greška i primeti.
--
-- NIKAD NE OBARA UPIS. Istorija je mreža ispod, ne uslov. Da okidač pukne
-- (nema mesta, izmenjena šema), sinhronizacija bi prestala da radi — a to je
-- gore od nemanja istorije. Zato je telo u `exception` bloku koji sve guta.
-- ---------------------------------------------------------------------
create or replace function public.user_state_zapamti()
returns trigger
language plpgsql
security definer                  -- korisnik nema upis u istoriju; okidač ima
set search_path = public
as $$
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
end $$;

drop trigger if exists user_state_zapamti_trg on public.user_state;
create trigger user_state_zapamti_trg
  before update on public.user_state
  for each row execute function public.user_state_zapamti();


-- ---------------------------------------------------------------------
-- 3. RLS — svako čita ISKLJUČIVO svoje verzije, i ništa ne piše
--
-- Nema politike za insert/update/delete: kroz RLS niko ne može da doda ni
-- obriše verziju. Piše samo okidač, koji je `security definer`.
-- Zašto je bitno da korisnik ne može da briše: istorija koja se može obrisati
-- iz aplikacije ne štiti od greške napravljene U APLIKACIJI.
-- ---------------------------------------------------------------------
alter table public.user_state_istorija enable row level security;

drop policy if exists user_state_istorija_citaj on public.user_state_istorija;
create policy user_state_istorija_citaj on public.user_state_istorija for select
  using (auth.uid() = user_id);

grant select on public.user_state_istorija to authenticated;
revoke all on public.user_state_istorija from anon;


-- =====================================================================
-- POSLE PUŠTANJA
-- Pusti i supabase/provera.sql — proverava i ove objekte.
--
-- KAKO SE KORISTI: Podešavanja → Podaci → „Ranije verzije".
--
-- BRISANJE NALOGA briše i istoriju: tabela je u spisku `TABELE`
-- (api/delete-account.js, api/broadcast.js, supabase/brisi-nalog.sql), a nosi
-- i `on delete cascade`. Vraćanje unazad posle brisanja naloga NE postoji i
-- ne treba da postoji — obrisano je obrisano.
-- =====================================================================
