-- RLS on subscriptions, api_keys and stripe_events (plan §4, §9).
-- Run with `npm run db:test`.
begin;
select plan(26);

-- Acme: Olivia (owner), Dev (developer), Mia (member). Globex: Gus (owner).
-- Nadia has no organisation. Ada is a Mintly admin.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', 'olivia@acme.test', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'dev@acme.test', '{}'),
  ('00000000-0000-0000-0000-0000000000a3', 'mia@acme.test', '{}'),
  ('00000000-0000-0000-0000-0000000000b1', 'gus@globex.test', '{}'),
  ('00000000-0000-0000-0000-0000000000c1', 'nadia@nowhere.test', '{}'),
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

insert into public.api_keys (id, org_id, stripe_subscription_item_id, usage_plan_id)
values
  ('key_acme', '10000000-0000-0000-0000-00000000000a', 'si_acme', 'plan_trial'),
  ('key_globex', '10000000-0000-0000-0000-00000000000b', 'si_globex', 'plan_paid');

insert into public.subscriptions
  (org_id, stripe_subscription_id, stripe_subscription_item_id, stripe_price_id, status, trialing, usage_plan_id, api_key_id)
values
  ('10000000-0000-0000-0000-00000000000a', 'sub_acme', 'si_acme', 'price_starter', 'trialing', true, 'plan_trial', 'key_acme'),
  ('10000000-0000-0000-0000-00000000000b', 'sub_globex', 'si_globex', 'price_pro', 'active', false, 'plan_paid', 'key_globex');

insert into public.stripe_events (id, type) values ('evt_1', 'checkout.session.completed');

-- Data model rules.
select throws_ok(
  $$ insert into public.subscriptions (org_id, stripe_subscription_id, stripe_price_id, status)
     values ('10000000-0000-0000-0000-00000000000a', 'sub_acme_2', 'price_pro', 'active') $$,
  '23505',
  null,
  'an organisation has at most one live subscription per product (BUY-05)'
);

select lives_ok(
  $$ insert into public.subscriptions (org_id, stripe_subscription_id, stripe_price_id, status, expired)
     values ('10000000-0000-0000-0000-00000000000a', 'sub_acme_old', 'price_pro', 'canceled', true) $$,
  'expired subscriptions are kept alongside the live one (SUB-06)'
);

select throws_ok(
  $$ insert into public.api_keys (id, org_id, stripe_subscription_item_id)
     values ('key_acme_2', '10000000-0000-0000-0000-00000000000a', 'si_acme') $$,
  '23505',
  null,
  'one key per subscription item, so a webhook retry reuses it (NFR-04)'
);

select throws_ok(
  $$ insert into public.stripe_events (id, type) values ('evt_1', 'checkout.session.completed') $$,
  '23505',
  null,
  'a Stripe event is recorded once'
);

-- provision_organisation (PROV-01): creates the organisation and owner once.
select is(
  public.provision_organisation('Initech', 'cus_initech', '00000000-0000-0000-0000-0000000000c1', 'approved'),
  public.provision_organisation('Initech again', 'cus_initech', '00000000-0000-0000-0000-0000000000c1', 'approved'),
  'a retried event returns the same organisation'
);
select is(
  (select role::text from public.memberships where user_id = '00000000-0000-0000-0000-0000000000c1'),
  'owner',
  'the buyer becomes the owner'
);
select throws_ok(
  $$ select public.provision_organisation('Other', 'cus_other', '00000000-0000-0000-0000-0000000000a3', 'approved') $$,
  '23505',
  null,
  'a buyer who already belongs to an organisation is refused'
);
select is(
  (select count(*)::int from public.organisations where stripe_customer_id = 'cus_other'),
  0,
  'and no organisation is left behind'
);
-- try_provision_lock (NFR-04): one run at a time per subscription.
select ok(public.try_provision_lock('sub_x'), 'the first run takes the lock');
select ok(not public.try_provision_lock('sub_x'), 'a concurrent run is refused');
update public.provision_locks set locked_at = now() - interval '2 minutes' where key = 'sub_x';
select ok(public.try_provision_lock('sub_x'), 'a stale lock is taken over');

-- Nadia (c1) now owns Initech; move her out again for the checks below.
delete from public.memberships where user_id = '00000000-0000-0000-0000-0000000000c1';

set local role authenticated;

-- Every Acme role reads Acme's subscription and key state, and nothing of Globex.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
select results_eq(
  $$ select stripe_subscription_id from public.subscriptions order by stripe_subscription_id $$,
  $$ values ('sub_acme'), ('sub_acme_old') $$,
  'the owner reads only their organisation''s subscriptions'
);
select results_eq($$ select id from public.api_keys $$, $$ values ('key_acme') $$, 'the owner reads only their organisation''s key');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated"}', true);
select is((select count(*)::int from public.subscriptions), 2, 'a developer reads their organisation''s subscriptions');
select results_eq($$ select id from public.api_keys $$, $$ values ('key_acme') $$, 'a developer reads their organisation''s key state');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a3", "role": "authenticated"}', true);
select is((select count(*)::int from public.subscriptions), 2, 'a member reads their organisation''s subscriptions');
select results_eq($$ select enabled from public.api_keys $$, $$ values (true) $$, 'a member reads the key''s state, never a value');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000c1", "role": "authenticated"}', true);
select is((select count(*)::int from public.subscriptions), 0, 'a user with no organisation reads no subscriptions');
select is((select count(*)::int from public.api_keys), 0, 'a user with no organisation reads no keys');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000d1", "role": "authenticated"}', true);
select is((select count(*)::int from public.subscriptions), 3, 'an admin reads every subscription');
select is((select count(*)::int from public.api_keys), 2, 'an admin reads every key''s state');

-- Nobody writes with a user session; the server does.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
select throws_ok(
  $$ update public.subscriptions set status = 'active' $$,
  '42501',
  null,
  'the owner cannot change a subscription'
);
select throws_ok(
  $$ update public.api_keys set enabled = true $$,
  '42501',
  null,
  'the owner cannot change a key'
);
select throws_ok(
  $$ select * from public.stripe_events $$,
  '42501',
  null,
  'users cannot read Stripe events'
);

reset role;
set local role anon;
select throws_ok($$ select * from public.subscriptions $$, '42501', null, 'anon cannot read subscriptions');
select throws_ok($$ select * from public.api_keys $$, '42501', null, 'anon cannot read keys');

select * from finish();
rollback;
