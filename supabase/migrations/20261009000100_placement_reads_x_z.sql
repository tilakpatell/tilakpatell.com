-- Two repairs to 20261009000000_world_entities.sql, found by
-- scripts/supabase-check.mjs on the real project.
--
-- 1. check_placement read new.geom, but a stored generated column is not yet
--    computed in a BEFORE trigger (it is NULL there), so ST_DWithin was NULL
--    and nothing was ever refused inside a POI. The point is made from x and
--    z instead, as the column itself would be.
-- 2. damage_entity was not found by the API after the first file ran; it is
--    made again (its arguments named by the function, so no name can be read
--    as a column) and the API told to reload its schema.
--
-- Anything already built inside a POI is removed: the rule held for no row.

create or replace function public.check_placement() returns trigger language plpgsql as $$
declare cap constant integer := 200;
begin
  if exists (
    select 1 from public.pois p
    where p.planet_id = new.planet_id and ST_DWithin(p.geom, ST_MakePoint(new.x, new.z), p.r)
  ) then
    raise exception 'inside a point of interest' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.world_entities e where e.owner = new.owner and e.planet_id = new.planet_id) >= cap then
    raise exception 'owner has % entities on this planet already', cap using errcode = 'check_violation';
  end if;
  return new;
end $$;

create or replace function public.damage_entity(entity_id uuid, amount integer) returns integer
language plpgsql volatile security definer set search_path = public as $$
declare caller uuid := auth.uid(); left_hp integer; dmg integer := least(greatest(damage_entity.amount, 1), 30);
begin
  if caller is null then raise exception 'sign in first' using errcode = 'insufficient_privilege'; end if;
  if (select count(*) from public.entity_hits h where h.by = caller and h.at > now() - interval '1 second') >= 10 then
    raise exception 'too many hits' using errcode = 'check_violation';
  end if;
  insert into public.entity_hits (entity_id, by) values (damage_entity.entity_id, caller);
  update public.world_entities e set hp = greatest(e.hp - dmg, 0) where e.id = damage_entity.entity_id returning e.hp into left_hp;
  if left_hp is null then return null; end if;
  if left_hp = 0 then delete from public.world_entities w where w.id = damage_entity.entity_id; end if;
  return left_hp;
end $$;
revoke execute on function public.damage_entity(uuid, integer) from public, anon;
grant execute on function public.damage_entity(uuid, integer) to authenticated;

delete from public.world_entities e
where exists (select 1 from public.pois p where p.planet_id = e.planet_id and ST_DWithin(p.geom, e.geom, p.r));

notify pgrst, 'reload schema';
