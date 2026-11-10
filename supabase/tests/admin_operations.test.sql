-- Admin operations (plan §6.8, phase 5): ownership transfer, Mintly admin
-- grants, and the admin's key switch. Run with `npm run db:test`.
begin;
select plan(17);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', 'olivia@acme.test', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'dev@acme.test', '{}'),
  ('00000000-0000-0000-0000-0000000000a3', 'mia@acme.test', '{}'),
  ('00000000-0000-0000-0000-0000000000b1', 'gus@globex.test', '{}'),
  ('00000000-0000-0000-0000-0000000000d1', 'ada@mintly.test', '{}'),
  ('00000000-0000-0000-0000-0000000000d2', 'bea@mintly.test', '{}');

update public.profiles set is_mintly_admin = true where id = '00000000-0000-0000-0000-0000000000d1';

insert into public.organisations (id, name, review_status)
values
  ('10000000-0000-0000-0000-00000000000a', 'Acme', 'approved'),
  ('10000000-0000-0000-0000-00000000000b', 'Globex', 'approved');

insert into public.memberships (org_id, user_id, role)
values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'developer'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'member'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner');

-- Ownership transfer (plan §3).
select throws_ok(
  $$ select public.transfer_ownership('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1') $$,
  'P0001',
  'the new owner must already be in the team',
  'ownership can only go to someone in the team'
);
select lives_ok(
  $$ select public.transfer_ownership('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000d1') $$,
  'an admin transfers ownership to a member'
);
select is(
  (select role::text from public.memberships where user_id = '00000000-0000-0000-0000-0000000000a3'),
  'owner',
  'the member is now the owner'
);
select is(
  (select role::text from public.memberships where user_id = '00000000-0000-0000-0000-0000000000a1'),
  'developer',
  'the previous owner is now a developer and keeps the key'
);
select is(
  (select count(*)::int from public.memberships where org_id = '10000000-0000-0000-0000-00000000000a' and role = 'owner'),
  1,
  'there is still exactly one owner'
);
select is(
  (select after ->> 'owner_id' from public.admin_audit where action = 'team.transfer_owner'),
  '00000000-0000-0000-0000-0000000000a3',
  'the transfer is audited'
);
select throws_ok(
  $$ select public.transfer_ownership('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000d1') $$,
  'P0001',
  'they are already the owner',
  'transferring to the owner is refused'
);

-- Mintly admins.
select lives_ok(
  $$ select public.set_mintly_admin('00000000-0000-0000-0000-0000000000d2', true, '00000000-0000-0000-0000-0000000000d1') $$,
  'an admin grants admin'
);
select is(
  (select is_mintly_admin from public.profiles where id = '00000000-0000-0000-0000-0000000000d2'),
  true,
  'the grant is saved'
);
select lives_ok(
  $$ select public.set_mintly_admin('00000000-0000-0000-0000-0000000000d1', false, '00000000-0000-0000-0000-0000000000d2') $$,
  'an admin is revoked while another remains'
);
select throws_ok(
  $$ select public.set_mintly_admin('00000000-0000-0000-0000-0000000000d2', false, '00000000-0000-0000-0000-0000000000d2') $$,
  'P0001',
  'there must always be at least one Mintly admin',
  'the last admin can''t be removed'
);
select is(
  (select array_agg(action order by id) from public.admin_audit where action like 'admin.%'),
  array['admin.grant', 'admin.revoke'],
  'grants and revokes are audited, and a refused revoke isn''t'
);

-- Only the service role may call them.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000d2", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.set_mintly_admin('00000000-0000-0000-0000-0000000000a1', true, '00000000-0000-0000-0000-0000000000d2') $$,
  '42501',
  null,
  'even an admin''s session can''t grant admin directly'
);
select throws_ok(
  $$ select public.transfer_ownership('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', null) $$,
  '42501',
  null,
  'a session can''t transfer ownership directly'
);
reset role;

-- The admin's key switch (plan §6.8): members can read it, nobody can write it.
insert into public.api_keys (id, org_id, stripe_subscription_item_id, usage_plan_id, enabled, disabled_by_admin)
values ('key_off', '10000000-0000-0000-0000-00000000000a', 'si_a', null, false, true);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated"}', true);
select is(
  (select disabled_by_admin from public.api_keys where id = 'key_off'),
  true,
  'a team member can see that an admin switched the key off'
);
select throws_ok(
  $$ update public.api_keys set disabled_by_admin = false where id = 'key_off' $$,
  '42501',
  null,
  'a team member can''t switch it back on'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated"}', true);
select is(
  (select count(*)::int from public.api_keys where id = 'key_off'),
  0,
  'another organisation can''t see the key'
);
reset role;

select * from finish();
rollback;
