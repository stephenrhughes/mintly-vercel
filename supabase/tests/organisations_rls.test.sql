-- RLS on organisations and memberships, the auth_org_id() and auth_role()
-- helpers, and teammates' profiles (plan §3, §4, §9). Run with `npm run db:test`.
begin;
select plan(24);

-- Two organisations. Acme: Olivia (owner), Dev (developer), Mia (member).
-- Globex: Gus (owner). Nadia has no organisation. Ada is a Mintly admin.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', 'olivia@acme.test', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'dev@acme.test', '{}'),
  ('00000000-0000-0000-0000-0000000000a3', 'mia@acme.test', '{}'),
  ('00000000-0000-0000-0000-0000000000b1', 'gus@globex.test', '{}'),
  ('00000000-0000-0000-0000-0000000000c1', 'nadia@nowhere.test', '{}'),
  ('00000000-0000-0000-0000-0000000000d1', 'ada@mintly.test', '{}');

update public.profiles set is_mintly_admin = true where id = '00000000-0000-0000-0000-0000000000d1';

insert into public.organisations (id, name, review_status, review_note, signup_signals)
values
  ('10000000-0000-0000-0000-00000000000a', 'Acme', 'approved', 'Checked the website', '{"ip": "192.0.2.1"}'),
  ('10000000-0000-0000-0000-00000000000b', 'Globex', 'pending_review', null, '{}');

insert into public.memberships (org_id, user_id, role)
values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'developer'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'member'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner');

-- Data model rules.
select throws_ok(
  $$ insert into public.memberships (org_id, user_id, role)
     values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'owner') $$,
  '23505',
  null,
  'an organisation has at most one owner'
);

select throws_ok(
  $$ insert into public.memberships (org_id, user_id, role)
     values ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000a3', 'member') $$,
  '23505',
  null,
  'a user belongs to at most one organisation'
);

select is(
  (select review_status::text from public.organisations where name = 'Acme'),
  'approved',
  'review status is stored'
);

-- Every role in Acme sees Acme and its members, and nothing of Globex.
set local role authenticated;

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
select is(public.auth_role()::text, 'owner', 'auth_role() is owner for the owner');
select is(public.auth_org_id(), '10000000-0000-0000-0000-00000000000a'::uuid, 'auth_org_id() is the owner''s organisation');
select results_eq($$ select name from public.organisations $$, $$ values ('Acme') $$, 'the owner sees only their organisation');
select is((select count(*)::int from public.memberships), 3, 'the owner sees their organisation''s memberships');
select is((select count(*)::int from public.profiles), 3, 'the owner sees their teammates'' profiles');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated"}', true);
select is(public.auth_role()::text, 'developer', 'auth_role() is developer for a developer');
select results_eq($$ select name from public.organisations $$, $$ values ('Acme') $$, 'a developer sees only their organisation');
select is((select count(*)::int from public.memberships), 3, 'a developer sees the team');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a3", "role": "authenticated"}', true);
select is(public.auth_role()::text, 'member', 'auth_role() is member for a member');
select results_eq($$ select name from public.organisations $$, $$ values ('Acme') $$, 'a member sees only their organisation');
select is((select count(*)::int from public.profiles), 3, 'a member sees the team''s profiles');

-- Nobody can read the review note or sign-up signals with a user session.
select throws_ok(
  $$ select review_note from public.organisations $$,
  '42501',
  null,
  'customers cannot read the review note'
);
select throws_ok(
  $$ select signup_signals from public.organisations $$,
  '42501',
  null,
  'customers cannot read the sign-up signals'
);

-- Nobody writes organisations or memberships with a user session; the
-- server does, with the service role.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
select throws_ok(
  $$ update public.organisations set name = 'Renamed' $$,
  '42501',
  null,
  'an owner cannot change the organisation directly'
);
select throws_ok(
  $$ update public.memberships set role = 'owner' where user_id = '00000000-0000-0000-0000-0000000000a3' $$,
  '42501',
  null,
  'an owner cannot change roles directly'
);
select throws_ok(
  $$ insert into public.memberships (org_id, user_id, role)
     values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', 'member') $$,
  '42501',
  null,
  'an owner cannot add members directly'
);

-- A user with no organisation sees none, and only their own profile.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000c1", "role": "authenticated"}', true);
select is(public.auth_org_id(), null, 'auth_org_id() is null without an organisation');
select is(
  (select count(*)::int from public.organisations) + (select count(*)::int from public.memberships),
  0,
  'a user with no organisation sees no organisations or memberships'
);
select is((select count(*)::int from public.profiles), 1, 'a user with no organisation sees only their own profile');

-- A Mintly admin reads every organisation and membership.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000d1", "role": "authenticated"}', true);
select is(
  (select count(*)::int from public.organisations) * 10 + (select count(*)::int from public.memberships),
  24,
  'an admin sees every organisation and membership'
);

-- Anonymous visitors see nothing.
reset role;
set local role anon;
select throws_ok($$ select id from public.organisations $$, '42501', null, 'anon cannot read organisations');

select * from finish();
rollback;
