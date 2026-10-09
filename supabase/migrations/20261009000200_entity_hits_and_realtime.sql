-- The tail of 20261009000000_world_entities.sql, again, for a project where it
-- did not run: scripts/supabase-check.mjs found no public.entity_hits on the
-- real project, so damage_entity failed on its first insert. Every statement
-- is safe on a project that has them already.

create table if not exists public.entity_hits (
  entity_id uuid not null references public.world_entities(id) on delete cascade,
  by uuid not null,
  at timestamptz not null default now()
);
create index if not exists entity_hits_by_at on public.entity_hits (by, at);
alter table public.entity_hits enable row level security; -- no policies: reached through damage_entity only

-- realtime: the table's changes go out to subscribers (RLS filters what each sees);
-- adding a table the publication holds already is an error, so it is asked first
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'world_entities'
  ) then
    alter publication supabase_realtime add table public.world_entities;
  end if;
end $$;

notify pgrst, 'reload schema';
