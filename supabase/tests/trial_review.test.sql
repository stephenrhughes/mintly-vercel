-- Trial review (plan §6.11): the review state machine and its audit, the
-- domain lists, blocked sign-ups and their RLS. Run with `npm run db:test`.
begin;
select plan(26);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', 'olivia@acme.test', '{}'),
  ('00000000-0000-0000-0000-0000000000b1', 'gus@globex.test', '{}'),
  ('00000000-0000-0000-0000-0000000000d1', 'ada@mintly.test', '{}');

update public.profiles set is_mintly_admin = true where id = '00000000-0000-0000-0000-0000000000d1';

insert into public.organisations (id, name, review_status, review_note, signup_signals)
values
  ('10000000-0000-0000-0000-00000000000a', 'Acme', 'approved', null, '{}'),
  ('10000000-0000-0000-0000-00000000000b', 'Globex', 'pending_review', null, '{"domain": "globex.test"}');

insert into public.memberships (org_id, user_id, role)
values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner');

-- The state machine.
select is(
  public.apply_review_decision('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000d1', 'ask_info', 'Please send your website'),
  'pending_review'::public.org_review_status,
  'asking for information keeps the review pending'
);
select is(
  (select review_note from public.organisations where name = 'Globex'),
  'Please send your website',
  'the request is recorded as the review note'
);
select is(
  public.apply_review_decision('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000d1', 'approve'),
  'approved'::public.org_review_status,
  'a pending organisation can be approved'
);
select is(
  (select reviewed_by from public.organisations where name = 'Globex'),
  '00000000-0000-0000-0000-0000000000d1'::uuid,
  'the reviewer is recorded'
);
select throws_ok(
  $$ select public.apply_review_decision('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000d1', 'decline') $$,
  'P0001',
  'cannot decline an organisation that is approved',
  'an approved organisation cannot be declined'
);
select throws_ok(
  $$ select public.apply_review_decision('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000d1', 'approve') $$,
  'P0001',
  'cannot approve an organisation that is approved',
  'approving twice is refused, so two admins cannot both act'
);
select is(
  public.apply_review_decision('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000d1', 'suspend', 'Card testing'),
  'suspended'::public.org_review_status,
  'an approved organisation can be suspended (APPR-08)'
);
select is(
  public.apply_review_decision('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000d1', 'reinstate'),
  'approved'::public.org_review_status,
  'a suspended organisation can be reinstated'
);
select throws_ok(
  $$ select public.apply_review_decision('10000000-0000-0000-0000-00000000000a', null, 'expire') $$,
  'P0001',
  null,
  'only a pending review can expire'
);
select throws_ok(
  $$ select public.apply_review_decision('10000000-0000-0000-0000-0000000000ff', null, 'approve') $$,
  'P0002',
  null,
  'an unknown organisation is refused'
);
select throws_ok(
  $$ select public.apply_review_decision('10000000-0000-0000-0000-00000000000a', null, 'promote') $$,
  'P0001',
  null,
  'an unknown action is refused'
);

-- Every decision is audited (APPR-05).
select results_eq(
  $$ select action, before ->> 'review_status', after ->> 'review_status'
     from public.admin_audit where target_org_id = '10000000-0000-0000-0000-00000000000b' order by id $$,
  $$ values
     ('review.ask_info', 'pending_review', 'pending_review'),
     ('review.approve', 'pending_review', 'approved'),
     ('review.suspend', 'approved', 'suspended'),
     ('review.reinstate', 'suspended', 'approved') $$,
  'each decision writes one audit entry with the before and after status'
);
select is(
  (select details ->> 'note' from public.admin_audit where action = 'review.suspend'),
  'Card testing',
  'the note is kept in the audit entry'
);
select is(
  (select count(*)::int from public.admin_audit where target_org_id = '10000000-0000-0000-0000-00000000000a'),
  0,
  'refused changes write no audit entry'
);

-- The approved-organisation domain rule (APPR-02).
select is(public.approved_org_for_domain('ACME.test'), '10000000-0000-0000-0000-00000000000a'::uuid, 'an approved organisation is found by its owner''s domain');
select is(public.approved_org_for_domain('initech.test'), null, 'an unknown domain finds nothing');
update public.organisations set review_status = 'suspended' where name = 'Acme';
select is(public.approved_org_for_domain('acme.test'), null, 'a suspended organisation does not count');

-- Blocked domains refuse sign-up; the allow-list still wins.
insert into public.blocked_domains (domain, reason) values ('scam.test', 'Repeated trials');
select is(
  public.signup_email_error('mallory@scam.test'),
  'We can''t accept sign-ups from this email domain. Email info@mintly.uk if you think this is a mistake.',
  'a blocked domain cannot sign up'
);
insert into public.signup_allowlist (entry) values ('qa@scam.test');
select is(public.signup_email_error('qa@scam.test'), null, 'the allow-list overrides a block');
select throws_ok(
  $$ insert into public.trusted_domains (domain) values ('Not A Domain') $$,
  '23514',
  null,
  'domains must be lower-case host names'
);

-- RLS: admins read the lists and the audit log; nobody else does, and no
-- one writes them with a user session.
insert into public.trusted_domains (domain) values ('bank.test');
set local role authenticated;

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000d1", "role": "authenticated"}', true);
select is((select count(*)::int from public.admin_audit), 4, 'an admin reads the audit log');
select is((select count(*)::int from public.trusted_domains), 1, 'an admin reads trusted domains');
select throws_ok(
  $$ insert into public.blocked_domains (domain) values ('evil.test') $$,
  '42501',
  null,
  'even an admin writes the lists only through the server'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
select is((select count(*)::int from public.admin_audit), 0, 'a customer reads no audit entries');
select is((select count(*)::int from public.blocked_domains), 0, 'a customer reads no blocked domains');
select throws_ok(
  $$ select public.apply_review_decision('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'reinstate') $$,
  '42501',
  null,
  'a customer cannot make review decisions'
);

select * from finish();
rollback;
