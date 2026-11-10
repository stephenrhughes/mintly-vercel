-- Phase 6d: the public free checker's rate limit (plan §4, §6.9; FREE-03).
-- 10 checks per IP address per week (the week starts on Monday, UK time),
-- and at least 2 seconds between checks. The IP is stored only as a keyed
-- hash (src/lib/review/request-signals.ts hashIp). Written only by the
-- server, through free_check_take(), which does the whole decision in one
-- atomic upsert so two requests at once can't both slip under the limit.

create table public.free_check_limits (
  ip_hash text not null check (length(ip_hash) between 16 and 128),
  week_start date not null,
  count integer not null default 0 check (count >= 0),
  last_at timestamptz not null default now(),
  primary key (ip_hash, week_start)
);

comment on table public.free_check_limits is
  'Free checker rate limit by hashed IP and week (FREE-03). Server only.';

create index free_check_limits_week_start_idx on public.free_check_limits (week_start);

alter table public.free_check_limits enable row level security;
revoke all on public.free_check_limits from anon, authenticated;
-- No policies: nobody reads or writes this with a session.

-- Takes one check for an IP hash, or says why not:
--   'ok'            the check may go ahead; used is the count including it
--   'weekly_limit'  the week's allowance is spent (used = the limit)
--   'too_fast'      within the minimum interval of the last check; nothing
--                   is counted, so a double click never costs a check
create or replace function public.free_check_take(
  p_ip_hash text,
  p_now timestamptz default now(),
  p_weekly_limit integer default 10,
  p_min_interval interval default interval '2 seconds'
)
returns table (result text, used integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_week date := date_trunc('week', p_now at time zone 'Europe/London')::date;
  v_count integer;
  v_last timestamptz;
begin
  insert into public.free_check_limits as l (ip_hash, week_start, count, last_at)
  values (p_ip_hash, v_week, 1, p_now)
  on conflict (ip_hash, week_start) do update
    set count = l.count + 1, last_at = excluded.last_at
    where l.count < p_weekly_limit and l.last_at <= excluded.last_at - p_min_interval
  returning l.count into v_count;

  if v_count is not null then
    -- Keep the table small: earlier weeks are never read again.
    delete from public.free_check_limits where week_start < v_week - 7;
    return query select 'ok'::text, v_count;
    return;
  end if;

  select l.count, l.last_at into v_count, v_last
  from public.free_check_limits l
  where l.ip_hash = p_ip_hash and l.week_start = v_week;

  if v_count >= p_weekly_limit then
    return query select 'weekly_limit'::text, v_count;
  else
    return query select 'too_fast'::text, v_count;
  end if;
end;
$$;

revoke execute on function public.free_check_take(text, timestamptz, integer, interval) from public, anon, authenticated;
grant execute on function public.free_check_take(text, timestamptz, integer, interval) to service_role;
