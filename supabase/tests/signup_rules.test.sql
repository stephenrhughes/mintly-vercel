-- Sign-up rules: the work-email denylist and its Auth hook (AUTH-04), and
-- terms versions on the profile (AUTH-05, AUTH-06, LEGAL-01).
-- Run with `npm run db:test`.
begin;
select plan(15);

select is(public.email_domain('Someone@Example.COM'), 'example.com', 'the domain is lower-cased');
select is(public.email_domain('"a@b"@gmail.com'), 'gmail.com', 'the domain is taken after the last @');
select is(public.email_domain('no-at-sign'), null, 'an address without @ has no domain');

select is(public.signup_email_error('jane@acme.co.uk'), null, 'a work email is allowed');
select is(
  public.signup_email_error('jane@GMAIL.com'),
  'Invalid email domain (gmail.com), please use a work email address',
  'a free email domain is refused with the AUTH-04 message'
);
select is(public.signup_email_error('jane'), 'Enter a valid email address', 'an invalid address is refused');

-- The allow-list replaces the hard-coded test bypass.
insert into public.signup_allowlist (entry, note) values ('tester@gmail.com', 'QA account');
select is(public.signup_email_error('Tester@gmail.com'), null, 'an allow-listed email is allowed');
select isnt(public.signup_email_error('other@gmail.com'), null, 'the allow-list is per address');
insert into public.signup_allowlist (entry) values ('yahoo.com');
select is(public.signup_email_error('anyone@yahoo.com'), null, 'an allow-listed domain is allowed');

-- The hook returns {} to allow and an error object to refuse.
select is(
  public.hook_before_user_created('{"user": {"email": "jane@acme.co.uk"}}'),
  '{}'::jsonb,
  'the hook allows a work email'
);
select is(
  public.hook_before_user_created('{"user": {"email": "jane@hotmail.com"}}') -> 'error' ->> 'message',
  'Invalid email domain (hotmail.com), please use a work email address',
  'the hook refuses a free email domain'
);

select ok(
  not has_function_privilege('anon', 'public.hook_before_user_created(jsonb)', 'execute'),
  'anon cannot call the hook directly'
);

-- The profile records the terms versions accepted at sign-up.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000e1', 'erin@acme.test',
   '{"first_name": " Erin ", "terms_accepted": true, "terms_version": "2026-01", "privacy_version": "2026-02", "marketing_opt_out": true}'),
  ('00000000-0000-0000-0000-0000000000e2', 'sso@acme.test', '{}');

select results_eq(
  $$ select terms_version, privacy_version, first_name, marketing_opt_out, terms_accepted_at is not null
     from public.profiles where id = '00000000-0000-0000-0000-0000000000e1' $$,
  $$ values ('2026-01', '2026-02', 'Erin', true, true) $$,
  'terms versions, acceptance time and marketing opt-out are recorded'
);
select is(
  (select terms_accepted_at from public.profiles where id = '00000000-0000-0000-0000-0000000000e2'),
  null,
  'no acceptance is recorded when the terms were not accepted'
);

update auth.users set email = 'erin.new@acme.test' where id = '00000000-0000-0000-0000-0000000000e1';
select is(
  (select email from public.profiles where id = '00000000-0000-0000-0000-0000000000e1'),
  'erin.new@acme.test',
  'the profile email follows an email change'
);

select * from finish();
rollback;
