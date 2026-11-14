-- =====================================================================
-- SUB-20 — V4: DEO KOJI ČEKA POTVRDU VLASNIKA (NIJE primenjen u bazi)
-- Kad vlasnik potvrdi i organizator primeni, tekst se prenosi u
-- supabase/v4.sql, a u inventar.sql i provera.sql se dodaju plan_v4_zapamti,
-- plan_v4_zapamti_trg i v4_iskljuci. Stil kao primenjeno stanje:
-- `(select auth.uid())`.
-- =====================================================================

create or replace function public.plan_v4_zapamti()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    if old.otisak is distinct from new.otisak then
      insert into public.plan_v4_verzija (user_id, rev, doc, otisak)
        values (old.user_id, old.rev, old.doc, old.otisak);
      delete from public.plan_v4_verzija
       where user_id = old.user_id
         and id not in (select id from public.plan_v4_verzija
                         where user_id = old.user_id order by id desc limit 10);
    end if;
  exception when others then
    null;  -- istorija nikad ne obara upis plana (kao istorija.sql)
  end;
  return new;
end $$;
drop trigger if exists plan_v4_zapamti_trg on public.plan_v4;
create trigger plan_v4_zapamti_trg after update on public.plan_v4
  for each row execute function public.plan_v4_zapamti();

revoke execute on function public.plan_v4_zapamti() from public, anon, authenticated;

create or replace function public.v4_iskljuci()
returns void language sql security definer set search_path = public as $$
  update public.v4_pristup set ukljuceno = false, od = now() where user_id = (select auth.uid());
$$;
revoke all on function public.v4_iskljuci() from public, anon;
grant execute on function public.v4_iskljuci() to authenticated;

