-- Admin customer set-up (ADM-12) and offers (ADM-11): owner invites, the
-- admin organisation, and offers' RLS. Run with `npm run db:test`.
begin;
select plan(16);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', 'olivia@acme.test', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'dev@acme.test', '{}'),
  ('00000000-0000-0000-0000-0000000000b1', 'gus@globex.test', '{}'),
  ('00000000-0000-0000-0000-0000000000d1', 'ada@mintly.test', '{}');

update public.profiles set is_mintly_admin = true where id = '00000000-0000-0000-0000-0000000000d1';

-- The admin sets up Acme: approved, audited, idempotent on the Stripe customer.
select is(
  (select public.create_admin_organisation('Acme', 'cus_acme', '00000000-0000-0000-0000-0000000000d1', '{"price": "price_custom"}')),
  (select public.create_admin_organisation('Acme again', 'cus_acme', '00000000-0000-0000-0000-0000000000d1')),
  'a retry with the same Stripe customer returns the same organisation'
);
select is(
  (select review_status::text from public.organisations where stripe_customer_id = 'cus_acme'),
  'approved',
  'an admin-created organisation is approved straight away'
);
select is(
  (select count(*)::int from public.admin_audit where action = 'customer.create'),
  1,
  'the set-up is audited once'
);

insert into public.subscriptions (org_id, stripe_subscription_id, stripe_price_id, status, max_team_size)
select id, 'sub_acme', 'price_custom', 'active', 5 from public.organisations where stripe_customer_id = 'cus_acme';

-- Owner invites.
select lives_ok(
  $$ select public.create_invitation(
       (select id from public.organisations where stripe_customer_id = 'cus_acme'),
       'olivia@acme.test', 'owner', 'hash_owner', '00000000-0000-0000-0000-0000000000d1', true) $$,
  'an organisation with no owner can invite one'
);
select throws_ok(
  $$ insert into public.invitations (org_id, email, role, token_hash, sent_at, expires_at)
     select id, 'other@acme.test', 'owner', 'hash_owner_2', now(), now() + interval '1 day'
     from public.organisations where stripe_customer_id = 'cus_acme' $$,
  '23505',
  null,
  'only one open owner invite at a time'
);
select lives_ok(
  $$ select public.accept_invitation('hash_owner', '00000000-0000-0000-0000-0000000000a1') $$,
  'the invited owner accepts'
);
select is(
  (select role::text from public.memberships where user_id = '00000000-0000-0000-0000-0000000000a1'),
  'owner',
  'they join as the owner'
);
select throws_ok(
  $$ select public.create_invitation(
       (select id from public.organisations where stripe_customer_id = 'cus_acme'),
       'dev@acme.test', 'owner', 'hash_owner_3', '00000000-0000-0000-0000-0000000000a1', true) $$,
  'P0001',
  'has an owner',
  'an organisation with an owner can''t invite another'
);
select lives_ok(
  $$ select public.create_invitation(
       (select id from public.organisations where stripe_customer_id = 'cus_acme'),
       'dev@acme.test', 'developer', 'hash_dev', '00000000-0000-0000-0000-0000000000a1', true) $$,
  'ordinary invites still work'
);

-- Offers.
insert into public.organisations (id, name, review_status)
values ('10000000-0000-0000-0000-00000000000b', 'Globex', 'approved');
insert into public.memberships (org_id, user_id, role)
values ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner');
select public.accept_invitation('hash_dev', '00000000-0000-0000-0000-0000000000a2');

insert into public.offers (org_id, email, stripe_price_id, headline, expires_at, revoked_at)
select id, null, 'price_offer', 'Acme open', now() + interval '7 days', null from public.organisations where stripe_customer_id = 'cus_acme'
union all
select id, null, 'price_offer', 'Acme withdrawn', now() + interval '7 days', now() from public.organisations where stripe_customer_id = 'cus_acme'
union all
select '10000000-0000-0000-0000-00000000000b', null, 'price_offer', 'Globex open', now() + interval '7 days', null;
insert into public.offers (email, stripe_price_id, headline, expires_at)
values ('lead@initech.test', 'price_offer', 'Prospect', now() + interval '7 days');

select throws_ok(
  $$ insert into public.offers (org_id, email, stripe_price_id, headline, expires_at)
     values ('10000000-0000-0000-0000-00000000000b', 'x@globex.test', 'price_offer', 'Both', now()) $$,
  '23514',
  null,
  'an offer is for an organisation or an email, not both'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
select is(
  (select array_agg(headline) from public.offers),
  array['Acme open'],
  'an owner reads only their organisation''s open offers'
);
select throws_ok(
  $$ insert into public.offers (email, stripe_price_id, headline, expires_at) values ('me@acme.test', 'p', 'h', now()) $$,
  '42501',
  null,
  'customers can''t create offers'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated"}', true);
select is((select count(*)::int from public.offers), 0, 'a developer doesn''t see offers');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000d1", "role": "authenticated"}', true);
select is((select count(*)::int from public.offers), 4, 'admins read every offer');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.create_admin_organisation('Mine', 'cus_mine', '00000000-0000-0000-0000-0000000000a1') $$,
  '42501',
  null,
  'a customer can''t create an approved organisation'
);
reset role;

set local role anon;
select throws_ok(
  $$ select count(*) from public.offers $$,
  '42501',
  null,
  'anonymous visitors can''t read offers'
);
reset role;

select * from finish();
rollback;
