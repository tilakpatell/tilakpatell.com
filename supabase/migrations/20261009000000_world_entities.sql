-- The world's durable things: planets, their fixed places, and what players
-- build on them, across the whole site. The design and its reasons:
-- docs/superpowers/specs/2026-10-09-planet-flight-and-shared-world-design.md
-- (Pillar 2). Apply with `supabase db push` or in the SQL editor; the check is
-- scripts/supabase-check.mjs (supabase/README.md).

create extension if not exists postgis;
create extension if not exists btree_gist;

-- the planets a thing may be built on (50 at launch: supabase/seed.sql)
create table if not exists public.planets (
  id   text primary key check (id ~ '^[A-Za-z0-9:_,-]{1,64}$'),
  name text not null,
  type text not null,
  seed text not null
);

-- fixed places on a planet: nothing may be built inside one
create table if not exists public.pois (
  id        text primary key,
  planet_id text not null references public.planets(id) on delete cascade,
  name      text not null,
  x double precision not null,
  z double precision not null,
  r double precision not null check (r > 0),
  geom geometry(Point, 0) generated always as (ST_MakePoint(x, z)) stored
);
create index if not exists pois_planet_geom on public.pois using gist (planet_id, geom);

create table if not exists public.world_entities (
  id          uuid primary key default gen_random_uuid(),
  planet_id   text not null references public.planets(id) on delete cascade,
  entity_type text not null check (entity_type in ('structure', 'turret', 'beacon', 'wreck')),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  x double precision not null check (abs(x) < 1e7),
  y double precision not null check (abs(y) < 1e5),
  z double precision not null check (abs(z) < 1e7),
  rot_x real not null default 0,
  rot_y real not null default 0,
  rot_z real not null default 0,
  scale real not null default 1 check (scale > 0 and scale <= 10),
  hp    integer not null default 100 check (hp >= 0 and hp <= 100000),
  metadata jsonb not null default '{}'::jsonb check (pg_column_size(metadata) <= 4096),
  geom geometry(Point, 0) generated always as (ST_MakePoint(x, z)) stored,
  version    integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- one index answers the envelope query: planet first (btree_gist), then the point
create index if not exists world_entities_planet_geom on public.world_entities using gist (planet_id, geom);
create index if not exists world_entities_planet_updated on public.world_entities (planet_id, updated_at);
create index if not exists world_entities_owner on public.world_entities (owner);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); new.version := old.version + 1; return new; end $$;
create trigger world_entities_touch before update on public.world_entities for each row execute function public.touch_updated_at();

-- what a build may not do: stand inside a POI, or take an owner past their cap on a planet
create or replace function public.check_placement() returns trigger language plpgsql as $$
declare cap constant integer := 200;
begin
  if exists (select 1 from public.pois p where p.planet_id = new.planet_id and ST_DWithin(p.geom, new.geom, p.r)) then
    raise exception 'inside a point of interest' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.world_entities e where e.owner = new.owner and e.planet_id = new.planet_id) >= cap then
    raise exception 'owner has % entities on this planet already', cap using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger world_entities_placement before insert on public.world_entities for each row execute function public.check_placement();

-- row-level security: the world is public to read; a row is its owner's to write
alter table public.planets enable row level security;
alter table public.pois enable row level security;
alter table public.world_entities enable row level security;
create policy planets_read on public.planets for select using (true);
create policy pois_read on public.pois for select using (true);
create policy entities_read on public.world_entities for select using (true);
create policy entities_insert on public.world_entities for insert to authenticated with check (owner = auth.uid());
create policy entities_update on public.world_entities for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy entities_delete on public.world_entities for delete to authenticated using (owner = auth.uid());

-- the envelope query the client makes as its view moves (security invoker: RLS applies)
create or replace function public.get_entities_in_bounding_box(
  planet_id text, min_x double precision, max_x double precision, min_z double precision, max_z double precision,
  since timestamptz default null
) returns setof public.world_entities
language plpgsql stable security invoker set search_path = public as $$
begin
  if max_x - min_x > 8192 or max_z - min_z > 8192 or max_x < min_x or max_z < min_z then
    raise exception 'envelope too large or inverted' using errcode = 'check_violation';
  end if;
  return query
    select e.* from public.world_entities e
    where e.planet_id = get_entities_in_bounding_box.planet_id
      and e.geom && ST_MakeEnvelope(min_x, min_z, max_x, max_z, 0)
      and (since is null or e.updated_at > since)
    order by e.updated_at
    limit 2000;
end $$;
grant execute on function public.get_entities_in_bounding_box(text, double precision, double precision, double precision, double precision, timestamptz) to anon, authenticated;

-- damage from anyone (a turret's hp is not its owner's alone to change): clamped, rate-limited, logged
create table if not exists public.entity_hits (
  entity_id uuid not null references public.world_entities(id) on delete cascade,
  by uuid not null,
  at timestamptz not null default now()
);
create index if not exists entity_hits_by_at on public.entity_hits (by, at);
alter table public.entity_hits enable row level security; -- no policies: reached through the function below only

create or replace function public.damage_entity(entity_id uuid, amount integer) returns integer
language plpgsql volatile security definer set search_path = public as $$
declare caller uuid := auth.uid(); left_hp integer; dmg integer := least(greatest(amount, 1), 30);
begin
  if caller is null then raise exception 'sign in first' using errcode = 'insufficient_privilege'; end if;
  if (select count(*) from public.entity_hits h where h.by = caller and h.at > now() - interval '1 second') >= 10 then
    raise exception 'too many hits' using errcode = 'check_violation';
  end if;
  insert into public.entity_hits (entity_id, by) values (entity_id, caller);
  update public.world_entities e set hp = greatest(e.hp - dmg, 0) where e.id = entity_id returning e.hp into left_hp;
  if left_hp is null then return null; end if;
  if left_hp = 0 then delete from public.world_entities where id = entity_id; end if;
  return left_hp;
end $$;
grant execute on function public.damage_entity(uuid, integer) to authenticated;

-- realtime: the table's changes go out to subscribers (RLS filters what each sees)
alter publication supabase_realtime add table public.world_entities;
