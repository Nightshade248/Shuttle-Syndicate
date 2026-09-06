-- Shuttle Syndicate V1.4.5 realtime + admin possession key
-- Run this entire script in Supabase SQL Editor.
-- The browser only uses the public/publishable (anon) key.
-- Do NOT put a service_role key in the website.

create extension if not exists pgcrypto;

create table if not exists public.shuttle_tournaments (
  id text primary key,
  state jsonb not null,
  admin_key_hash text not null,
  updated_at timestamptz not null default now()
);

alter table public.shuttle_tournaments enable row level security;

-- Public players can read tournament state only. They cannot directly write rows.
revoke insert, update, delete on public.shuttle_tournaments from anon, authenticated;
grant select (id, state, updated_at) on public.shuttle_tournaments to anon, authenticated;

drop policy if exists "public can read shuttle tournaments" on public.shuttle_tournaments;
create policy "public can read shuttle tournaments"
on public.shuttle_tournaments
for select to anon, authenticated
using (true);

-- Admin writes go through the SECURITY DEFINER function below. The admin key is
-- hashed in the database and is never included in the shared player state.
drop function if exists public.upsert_shuttle_tournament(text,text,jsonb);
create or replace function public.upsert_shuttle_tournament(
  p_id text,
  p_admin_key text,
  p_state jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  existing_hash text;
  supplied_hash text;
begin
  if p_id is null or length(trim(p_id)) = 0 or p_admin_key is null or length(p_admin_key) < 16 then
    raise exception 'Invalid tournament credentials';
  end if;

  supplied_hash := encode(digest(p_admin_key, 'sha256'), 'hex');

  select admin_key_hash into existing_hash
  from public.shuttle_tournaments
  where id = p_id;

  if existing_hash is null then
    insert into public.shuttle_tournaments(id, state, admin_key_hash, updated_at)
    values (p_id, p_state, supplied_hash, now());
    return true;
  end if;

  if existing_hash <> supplied_hash then
    raise exception 'Unauthorized tournament update';
  end if;

  update public.shuttle_tournaments
  set state = p_state,
      updated_at = now()
  where id = p_id;

  return true;
end;
$$;

revoke all on function public.upsert_shuttle_tournament(text,text,jsonb) from public;
grant execute on function public.upsert_shuttle_tournament(text,text,jsonb) to anon, authenticated;

-- Realtime publication for the tournament state table.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'shuttle_tournaments'
  ) then
    alter publication supabase_realtime add table public.shuttle_tournaments;
  end if;
end $$;
