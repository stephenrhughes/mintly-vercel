-- The free checker's rate limit (plan §6.9, FREE-03). Run with `npm run db:test`.
begin;
select plan(12);

-- Monday 9 November 2026, 10:00 UK time.
select is(
  (select result from public.free_check_take('hash-aaaaaaaaaaaaaaaa', '2026-11-09 10:00:00+00')),
  'ok', 'the first check of the week is allowed'
);
select is(
  (select result from public.free_check_take('hash-aaaaaaaaaaaaaaaa', '2026-11-09 10:00:01+00')),
  'too_fast', 'a second check within 2 seconds is refused'
);
select is(
  (select count from public.free_check_limits where ip_hash = 'hash-aaaaaaaaaaaaaaaa'),
  1, 'a refused fast check is not counted, so a double click costs nothing'
);

-- Use up the week, 3 seconds apart.
select public.free_check_take('hash-aaaaaaaaaaaaaaaa', '2026-11-09 10:00:00+00'::timestamptz + make_interval(secs => n * 3))
from generate_series(1, 9) as n;
select is(
  (select count from public.free_check_limits where ip_hash = 'hash-aaaaaaaaaaaaaaaa'),
  10, 'ten checks are counted'
);
select results_eq(
  $$ select result, used from public.free_check_take('hash-aaaaaaaaaaaaaaaa', '2026-11-12 10:00:00+00') $$,
  $$ values ('weekly_limit'::text, 10) $$,
  'the eleventh check that week is refused'
);
select is(
  (select result from public.free_check_take('hash-aaaaaaaaaaaaaaaa', '2026-11-15 23:59:00+00')),
  'weekly_limit', 'still refused late on Sunday'
);
select is(
  (select result from public.free_check_take('hash-aaaaaaaaaaaaaaaa', '2026-11-16 00:30:00+00')),
  'ok', 'allowed again from Monday'
);
select is(
  (select result from public.free_check_take('hash-bbbbbbbbbbbbbbbb', '2026-11-12 10:00:00+00')),
  'ok', 'each IP hash has its own allowance'
);
select is(
  (select count(*)::int from public.free_check_limits where week_start < '2026-11-09'),
  0, 'old weeks are cleared'
);

set local role anon;
select throws_ok(
  $$ select * from public.free_check_take('hash-cccccccccccccccc') $$,
  '42501', null, 'anonymous visitors can''t call it directly'
);
select throws_ok($$ select count(*) from public.free_check_limits $$, '42501', null, 'or read the table');
reset role;

set local role authenticated;
select throws_ok(
  $$ select * from public.free_check_take('hash-cccccccccccccccc') $$,
  '42501', null, 'nor can signed-in users'
);
reset role;

select * from finish();
rollback;
