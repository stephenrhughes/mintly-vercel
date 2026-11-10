-- Teams (plan §6.6): invitations, seats, joining and their RLS.
-- Run with `npm run db:test`.
begin;
select plan(30);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', 'olivia@acme.test', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'dev@acme.test', '{}'),
  ('00000000-0000-0000-0000-0000000000a3', 'mia@acme.test', '{}'),
  ('00000000-0000-0000-0000-0000000000a4', 'new@acme.test', '{}'),
  ('00000000-0000-0000-0000-0000000000b1', 'gus@globex.test', '{}'),
  ('00000000-0000-0000-0000-0000000000b2', 'mover@acme.test', '{}');

insert into public.organisations (id, name, review_status)
values
  ('10000000-0000-0000-0000-00000000000a', 'Acme', 'approved'),
  ('10000000-0000-0000-0000-00000000000b', 'Globex', 'approved'),
  ('10000000-0000-0000-0000-00000000000c', 'Pending Co', 'pending_review');

insert into public.memberships (org_id, user_id, role)
values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'developer'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b2', 'member');

-- Acme: 3 seats included, 1 extra = 4. Globex has no recorded limit.
insert into public.subscriptions (org_id, stripe_subscription_id, stripe_price_id, status, max_team_size, extra_users)
values
  ('10000000-0000-0000-0000-00000000000a', 'sub_acme', 'price_pro', 'active', 3, 1),
  ('10000000-0000-0000-0000-00000000000b', 'sub_globex', 'price_x', 'active', null, 0),
  ('10000000-0000-0000-0000-00000000000c', 'sub_pending', 'price_x', 'trialing', 1, 0);

-- The server calls these with the service role.
select set_config('request.jwt.claims', '{"role": "service_role"}', true);

-- Seat limits (TEAM-03).
select is(public.org_seat_limit('10000000-0000-0000-0000-00000000000a'), 4, 'the limit is maxTeamSize plus extraUsers');
select is(public.org_seat_limit('10000000-0000-0000-0000-00000000000b'), null, 'no recorded limit is null');

-- Creating invites (TEAM-05).
select isnt(
  public.create_invitation('10000000-0000-0000-0000-00000000000a', 'Mia@Acme.test', 'member', 'hash-mia', '00000000-0000-0000-0000-0000000000a1', true),
  null,
  'an owner can invite while seats are free'
);
select is(
  (select email from public.invitations where token_hash = 'hash-mia'),
  'mia@acme.test',
  'the address is stored lower-cased'
);
select ok(
  (select expires_at between now() + interval '13 days 23 hours' and now() + interval '14 days 1 minute'
   from public.invitations where token_hash = 'hash-mia'),
  'a sent invite expires after 14 days'
);
select throws_ok(
  $$ select public.create_invitation('10000000-0000-0000-0000-00000000000a', 'mia@acme.test', 'member', 'hash-mia-2', null, true) $$,
  'P0001', 'already invited', 'a second open invite to the same address is refused'
);
select throws_ok(
  $$ select public.create_invitation('10000000-0000-0000-0000-00000000000a', 'dev@acme.test', 'member', 'hash-dev', null, true) $$,
  'P0001', 'already a member', 'inviting a member is refused'
);
select lives_ok(
  $$ select public.create_invitation('10000000-0000-0000-0000-00000000000a', 'new@acme.test', 'developer', 'hash-new', null, true) $$,
  'the fourth seat can be taken by an invite'
);
select throws_ok(
  $$ select public.create_invitation('10000000-0000-0000-0000-00000000000a', 'more@acme.test', 'member', 'hash-more', null, true) $$,
  'P0001', 'team full', 'members plus pending invites fill the limit, so the next invite is refused'
);
select is(
  (select row(seat_limit, members, pending_invites)::text from public.org_seat_usage('10000000-0000-0000-0000-00000000000a')),
  '(4,2,2)',
  'seat usage counts members and pending invites'
);
select throws_ok(
  $$ select public.create_invitation('10000000-0000-0000-0000-00000000000b', 'x@globex.test', 'owner', 'hash-owner', null, true) $$,
  'P0001', 'has an owner', 'nobody is invited as owner while the organisation has one'
);

-- Expired invites free their seat.
update public.invitations set sent_at = now() - interval '15 days', expires_at = now() - interval '1 day'
where token_hash = 'hash-new';
select is(
  (select pending_invites from public.org_seat_usage('10000000-0000-0000-0000-00000000000a')),
  1,
  'an expired invite no longer holds a seat'
);
select lives_ok(
  $$ select public.create_invitation('10000000-0000-0000-0000-00000000000a', 'new@acme.test', 'developer', 'hash-new-2', null, true) $$,
  'an expired invite can be replaced by a new one'
);

-- Held invites (plan §6.11).
select lives_ok(
  $$ select public.create_invitation('10000000-0000-0000-0000-00000000000c', 'held@pending.test', 'member', 'hash-held', null, false) $$,
  'an invite from a pending organisation is held'
);
select throws_ok(
  $$ select public.create_invitation('10000000-0000-0000-0000-00000000000c', 'held2@pending.test', 'member', 'hash-held-2', null, false) $$,
  'P0001', 'team full', 'a held invite still holds a seat'
);
-- Joining.
select throws_ok(
  $$ select public.accept_invitation('nope', '00000000-0000-0000-0000-0000000000a3') $$,
  'P0001', 'invite not found', 'an unknown token is refused'
);
select throws_ok(
  $$ select public.accept_invitation('hash-mia', '00000000-0000-0000-0000-0000000000a4') $$,
  'P0001', 'wrong email', 'the signed-in email must match the invite (JOIN-02)'
);
select throws_ok(
  $$ select public.accept_invitation('hash-new', '00000000-0000-0000-0000-0000000000a4') $$,
  'P0001', 'invite withdrawn', 'a replaced invite cannot be used'
);
select is(
  public.accept_invitation('hash-mia', '00000000-0000-0000-0000-0000000000a3'),
  '10000000-0000-0000-0000-00000000000a'::uuid,
  'the invitee joins (JOIN-05)'
);
select is(
  (select role::text from public.memberships where user_id = '00000000-0000-0000-0000-0000000000a3'),
  'member',
  'with the invited role'
);
select throws_ok(
  $$ select public.accept_invitation('hash-mia', '00000000-0000-0000-0000-0000000000a3') $$,
  'P0001', 'already joined', 'opening the link again says they have already joined'
);

-- Moving from another organisation needs consent; owners can't move.
update public.subscriptions set extra_users = 3 where stripe_subscription_id = 'sub_acme';
select public.create_invitation('10000000-0000-0000-0000-00000000000a', 'mover@acme.test', 'member', 'hash-mover', null, true);
select throws_ok(
  $$ select public.accept_invitation('hash-mover', '00000000-0000-0000-0000-0000000000b2') $$,
  'P0001', 'needs consent', 'a member of another organisation is not moved without consent'
);
select lives_ok(
  $$ select public.accept_invitation('hash-mover', '00000000-0000-0000-0000-0000000000b2', true) $$,
  'with consent they move'
);
select is(
  (select org_id from public.memberships where user_id = '00000000-0000-0000-0000-0000000000b2'),
  '10000000-0000-0000-0000-00000000000a'::uuid,
  'and leave their old organisation'
);

update public.profiles set email = 'gus@acme.test' where id = '00000000-0000-0000-0000-0000000000b1';
select public.create_invitation('10000000-0000-0000-0000-00000000000a', 'gus@acme.test', 'member', 'hash-gus', null, true);
select throws_ok(
  $$ select public.accept_invitation('hash-gus', '00000000-0000-0000-0000-0000000000b1', true) $$,
  'P0001', 'owns another organisation', 'the owner of another organisation cannot be moved'
);

-- JOIN-03: an ended subscription.
update public.subscriptions set expired = true where stripe_subscription_id = 'sub_acme';
update public.profiles set email = 'gus@globex.test' where id = '00000000-0000-0000-0000-0000000000b1';
select throws_ok(
  $$ select public.accept_invitation('hash-new-2', '00000000-0000-0000-0000-0000000000a4') $$,
  'P0001', 'not subscribed', 'nobody joins an organisation whose subscription has ended'
);
update public.subscriptions set expired = false where stripe_subscription_id = 'sub_acme';

-- RLS.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
select ok(
  (select count(*) from public.invitations) >= 3
  and (select bool_and(org_id = '10000000-0000-0000-0000-00000000000a') from public.invitations),
  'the owner reads their organisation''s invitations only'
);
select throws_ok(
  $$ select token_hash from public.invitations $$,
  '42501', null, 'nobody reads token hashes with a user session'
);
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated"}', true);
select is((select count(*)::integer from public.invitations), 0, 'a developer does not read invitations');
select throws_ok(
  $$ select * from public.org_seat_usage('10000000-0000-0000-0000-00000000000b') $$,
  '42501', 'not allowed', 'seat usage of another organisation is refused'
);

select * from finish();
rollback;
