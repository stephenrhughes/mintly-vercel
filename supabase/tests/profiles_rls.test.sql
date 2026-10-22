-- RLS and column privileges on public.profiles. Run with `npm run db:test`.
begin;
select plan(9);

-- Two users; the trigger creates their profiles.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', '{"first_name": "Alice", "company_name": "Acme"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com', '{}');

select is(
  (select first_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'Alice',
  'profile is created from sign-up metadata'
);

-- Act as Alice.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}', true);

select is((select count(*)::int from public.profiles), 1, 'a user sees only their own profile');
select is(public.is_mintly_admin(), false, 'a normal user is not an admin');

update public.profiles set last_name = 'Smith' where id = '00000000-0000-0000-0000-00000000000a';
select is(
  (select last_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'Smith',
  'a user can update their own contact details'
);

select throws_ok(
  $$ update public.profiles set is_mintly_admin = true where id = '00000000-0000-0000-0000-00000000000a' $$,
  '42501',
  null,
  'a user cannot make themselves an admin'
);

select throws_ok(
  $$ update public.profiles set email = 'x@example.com' where id = '00000000-0000-0000-0000-00000000000a' $$,
  '42501',
  null,
  'a user cannot change the email on their profile'
);

update public.profiles set first_name = 'Mallory' where id = '00000000-0000-0000-0000-00000000000b';
reset role;
select is(
  (select first_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  null,
  'a user cannot update someone else''s profile'
);

-- Make Alice an admin (as the server would) and check she can read everyone.
update public.profiles set is_mintly_admin = true where id = '00000000-0000-0000-0000-00000000000a';
set local role authenticated;
select is((select count(*)::int from public.profiles), 2, 'an admin sees every profile');

-- Anonymous visitors see nothing.
reset role;
set local role anon;
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon cannot read profiles');

select * from finish();
rollback;
