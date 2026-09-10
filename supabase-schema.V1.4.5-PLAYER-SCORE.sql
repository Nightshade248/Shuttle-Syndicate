-- Shuttle Syndicate V1.4.5 player score-entry realtime update path
-- Run this after the existing V1.4.5 schema.
-- Player shared links can update the tournament state through this RPC.
-- Direct table writes remain blocked by RLS.
-- Security hardening / authentication is intentionally deferred.

create or replace function public.upsert_shuttle_player_state(
  p_id text,
  p_state jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_id is null or length(trim(p_id)) = 0 or p_state is null then
    raise exception 'Invalid tournament state';
  end if;

  if not exists (select 1 from public.shuttle_tournaments where id = p_id) then
    raise exception 'Tournament not found';
  end if;

  update public.shuttle_tournaments
  set state = p_state,
      updated_at = now()
  where id = p_id;

  return true;
end;
$$;

revoke all on function public.upsert_shuttle_player_state(text,jsonb) from public;
grant execute on function public.upsert_shuttle_player_state(text,jsonb) to anon, authenticated;
