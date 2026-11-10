-- plan_changes (plan §4, §6.12): data rules and RLS. Run with `npm run db:test`.
begin;
select plan(17);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', 'olivia@acme.test', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'dev@acme.test', '{}'),
  ('00000000-0000-0000-0000-0000000000a3', 'mia@acme.test', '{}'),
  ('00000000-0000-0000-0000-0000000000b1', 'gus@globex.test', '{}'),
  ('00000000-0000-0000-0000-0000000000d1', 'ada@mintly.test', '{}');

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

insert into public.plan_changes
  (org_id, actor_id, actor_kind, stripe_subscription_id, from_price_id, to_price_id, kind, effective_at, status)
values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'owner', 'sub_a', 'price_starter', 'price_pro', 'upgrade', now(), 'done'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'owner', 'sub_a', 'price_pro', 'price_starter', 'downgrade_scheduled', now() + interval '20 days', 'scheduled'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner', 'sub_b', 'price_starter', 'price_pro', 'trial_switch', now(), 'done');

select throws_ok(
  $$ insert into public.plan_changes
       (org_id, actor_kind, stripe_subscription_id, from_price_id, to_price_id, kind, effective_at, status)
     values ('10000000-0000-0000-0000-00000000000a', 'owner', 'sub_a', 'price_pro', 'price_plus', 'downgrade_scheduled', now(), 'scheduled') $$,
  '23505',
  null,
  'an organisation has at most one scheduled change'
);
select lives_ok(
  $$ update public.plan_changes set status = 'cancelled' where status = 'scheduled' and org_id = '10000000-0000-0000-0000-00000000000a';
     insert into public.plan_changes
       (org_id, actor_kind, stripe_subscription_id, from_price_id, to_price_id, kind, effective_at, status)
     values ('10000000-0000-0000-0000-00000000000a', 'owner', 'sub_a', 'price_pro', 'price_plus', 'downgrade_scheduled', now(), 'scheduled') $$,
  'a new scheduled change can replace a cancelled one'
);
select has_column('public', 'subscriptions', 'trial_reminders_sent', 'subscriptions record which trial reminders were sent (PLAN-08)');
select has_column('public', 'api_keys', 'retire_at', 'keys can be retired after an overlap (KEY-01)');

-- Key rotation (KEY-01).
insert into public.api_keys (id, org_id, stripe_subscription_item_id, usage_plan_id)
values ('key_old', '10000000-0000-0000-0000-00000000000a', 'si_a', 'plan_paid');
insert into public.subscriptions (org_id, stripe_subscription_id, stripe_subscription_item_id, stripe_price_id, status, api_key_id)
values ('10000000-0000-0000-0000-00000000000a', 'sub_a', 'si_a', 'price_pro', 'active', 'key_old');

select lives_ok(
  $$ select public.record_key_rotation('key_old', 'key_new', now() + interval '24 hours', '00000000-0000-0000-0000-0000000000a2', '{"when": "24h"}') $$,
  'a developer''s rotation is recorded'
);
select results_eq(
  $$ select id, stripe_subscription_item_id, enabled, usage_plan_id, rotated_from, retire_at is not null
     from public.api_keys order by id desc $$,
  $$ values ('key_old'::text, null::text, true, 'plan_paid'::text, null::text, true),
            ('key_new', 'si_a', true, 'plan_paid', 'key_old', false) $$,
  'the new key takes the item and plan; the old one keeps working until it retires'
);
select is(
  (select api_key_id from public.subscriptions where stripe_subscription_id = 'sub_a'),
  'key_new',
  'the subscription points at the new key'
);
select is(
  (select action || ' by ' || actor_id::text from public.admin_audit where action = 'key.rotate'),
  'key.rotate by 00000000-0000-0000-0000-0000000000a2',
  'the rotation is audited with who did it'
);
select throws_ok(
  $$ select public.record_key_rotation('key_old', 'key_newer', now(), null) $$,
  'P0001',
  null,
  'a key already being retired cannot be rotated again'
);
select throws_ok(
  $$ select public.record_key_rotation('key_missing', 'key_x', now(), null) $$,
  'P0002',
  null,
  'an unknown key is refused'
);

set local role authenticated;

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
select is((select count(*)::int from public.plan_changes), 3, 'the owner reads their organisation''s plan changes');
select is(
  (select count(*)::int from public.plan_changes where org_id = '10000000-0000-0000-0000-00000000000b'),
  0,
  'and none of another organisation''s'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated"}', true);
select is((select count(*)::int from public.plan_changes), 0, 'a developer reads no plan changes (billing is the owner''s)');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a3", "role": "authenticated"}', true);
select is((select count(*)::int from public.plan_changes), 0, 'a member reads no plan changes');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000d1", "role": "authenticated"}', true);
select is((select count(*)::int from public.plan_changes), 4, 'an admin reads every plan change');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
select throws_ok(
  $$ update public.plan_changes set status = 'done' $$,
  '42501',
  null,
  'the owner cannot change the history'
);

reset role;
set local role anon;
select throws_ok($$ select * from public.plan_changes $$, '42501', null, 'anon cannot read plan changes');

select * from finish();
rollback;
