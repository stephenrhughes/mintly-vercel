-- RLS on usage_daily and check_log, and check_counts() (plan §4, §6.2, §6.4).
-- Run with `npm run db:test`.
begin;
select plan(20);

-- Acme: Olivia (owner), Dev (developer), Mia (member). Globex: Gus (owner).
-- Ada is a Mintly admin with no organisation.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', 'olivia@acme.test', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'dev@acme.test', '{}'),
  ('00000000-0000-0000-0000-0000000000a3', 'mia@acme.test', '{}'),
  ('00000000-0000-0000-0000-0000000000b1', 'gus@globex.test', '{}'),
  ('00000000-0000-0000-0000-0000000000d1', 'ada@mintly.test', '{}');

update public.profiles set is_mintly_admin = true where id = '00000000-0000-0000-0000-0000000000d1';

insert into public.organisations (id, name, review_status, stripe_customer_id)
values
  ('10000000-0000-0000-0000-00000000000a', 'Acme', 'approved', 'cus_acme'),
  ('10000000-0000-0000-0000-00000000000b', 'Globex', 'approved', 'cus_globex');

insert into public.memberships (org_id, user_id, role)
values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'developer'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'member'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner');

-- Acme has a rotated key: both count towards its usage (KEY-01).
insert into public.api_keys (id, org_id, stripe_subscription_item_id, usage_plan_id, rotated_from)
values
  ('key_acme_old', '10000000-0000-0000-0000-00000000000a', null, 'plan_a', null),
  ('key_acme', '10000000-0000-0000-0000-00000000000a', 'si_acme', 'plan_a', 'key_acme_old'),
  ('key_globex', '10000000-0000-0000-0000-00000000000b', 'si_globex', 'plan_b', null);

insert into public.usage_daily (api_key_id, date, success, not_found)
values
  ('key_acme_old', '2026-11-01', 5, 1),
  ('key_acme', '2026-11-01', 10, 2),
  ('key_globex', '2026-11-01', 99, 9);

insert into public.check_log (org_id, user_id, kind, mode, outcome)
values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'account', 'single', 'valid'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'account', 'bulk', 'valid'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'iban', 'bulk', 'invalid'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'swift', 'single', 'valid');

-- Data rules.
select throws_ok(
  $$ insert into public.usage_daily (api_key_id, date) values ('key_acme', '2026-11-01') $$,
  '23505',
  null,
  'one usage row per key and day'
);
select throws_ok(
  $$ insert into public.usage_daily (api_key_id, date, success) values ('key_acme', '2026-11-02', -1) $$,
  '23514',
  null,
  'usage counts are never negative'
);
select hasnt_column('public', 'check_log', 'value', 'check_log has no column for bank details');

set local role authenticated;

-- The owner reads their organisation's usage (both keys) and every check.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
select results_eq(
  $$ select api_key_id from public.usage_daily order by api_key_id $$,
  $$ values ('key_acme'), ('key_acme_old') $$,
  'the owner reads usage for their organisation''s keys only (MON-06)'
);
select is((select count(*)::int from public.check_log), 3, 'the owner reads every check in their organisation');
select results_eq(
  $$ select user_id, checks from public.check_counts(now() - interval '1 day') order by user_id $$,
  $$ values ('00000000-0000-0000-0000-0000000000a1'::uuid, 1::bigint),
            ('00000000-0000-0000-0000-0000000000a3'::uuid, 2::bigint) $$,
  'the owner gets a count for each person (plan §6.4)'
);

-- A developer reads usage and only their own checks (plan §13.6).
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated"}', true);
select is((select count(*)::int from public.usage_daily), 2, 'a developer reads their organisation''s usage');
select is((select count(*)::int from public.check_log), 0, 'a developer reads only their own checks');
select is((select count(*)::int from public.check_counts(now() - interval '1 day')), 0, 'and gets no one else''s count');

-- A member reads usage and their own checks.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a3", "role": "authenticated"}', true);
select is((select count(*)::int from public.usage_daily), 2, 'a member reads their organisation''s usage');
select is((select count(*)::int from public.check_log), 2, 'a member reads their own checks');
select results_eq(
  $$ select user_id, checks from public.check_counts(now() - interval '1 day') $$,
  $$ values ('00000000-0000-0000-0000-0000000000a3'::uuid, 2::bigint) $$,
  'a member gets their own count only'
);

-- Nobody signed in writes either table; the server does.
select throws_ok(
  $$ insert into public.check_log (org_id, user_id, kind, mode, outcome)
     values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'account', 'single', 'valid') $$,
  '42501',
  null,
  'users can''t write the check log'
);
select throws_ok(
  $$ insert into public.usage_daily (api_key_id, date) values ('key_acme', '2026-11-03') $$,
  '42501',
  null,
  'users can''t write usage'
);
select throws_ok(
  $$ delete from public.check_log $$,
  '42501',
  null,
  'users can''t delete checks'
);

-- Another organisation sees none of Acme's rows.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated"}', true);
select results_eq(
  $$ select api_key_id from public.usage_daily $$,
  $$ values ('key_globex') $$,
  'another organisation reads only its own usage'
);
select is((select count(*)::int from public.check_log), 1, 'and only its own checks');

-- Admins read everything.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000d1", "role": "authenticated"}', true);
select is((select count(*)::int from public.usage_daily), 3, 'an admin reads all usage');
select is((select count(*)::int from public.check_log), 4, 'an admin reads all checks');

-- Anonymous visitors read nothing.
set local role anon;
select throws_ok($$ select count(*) from public.check_log $$, '42501', null, 'anonymous visitors can''t read the check log');

select * from finish();
rollback;
