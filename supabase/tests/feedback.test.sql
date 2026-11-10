-- tool_ratings and enquiries (plan §4, §6.8): admins read, nobody else
-- reads or writes with a session. Run with `npm run db:test`.
begin;
select plan(9);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', 'olivia@acme.test', '{}'),
  ('00000000-0000-0000-0000-0000000000d1', 'ada@mintly.test', '{}');
update public.profiles set is_mintly_admin = true where id = '00000000-0000-0000-0000-0000000000d1';

insert into public.tool_ratings (rating, feedback, source) values (5, 'Great', 'free-checker');
insert into public.enquiries (name, email, answers, outcome)
values ('Pat', 'pat@initech.test', '{"volume": "250_10k"}', 'trial_standard_plus');

select throws_ok(
  $$ insert into public.tool_ratings (rating) values (6) $$,
  '23514', null, 'ratings are 1 to 5'
);
select has_column('public', 'enquiries', 'answers', 'enquiries keep the structured answers');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000d1", "role": "authenticated"}', true);
select is((select count(*)::int from public.tool_ratings), 1, 'admins read ratings');
select is((select count(*)::int from public.enquiries), 1, 'admins read enquiries');
select throws_ok(
  $$ insert into public.enquiries (name, email) values ('x', 'x@y.test') $$,
  '42501', null, 'even admins don''t write enquiries with a session'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
select is((select count(*)::int from public.tool_ratings), 0, 'customers read no ratings');
select is((select count(*)::int from public.enquiries), 0, 'customers read no enquiries');
select throws_ok(
  $$ insert into public.tool_ratings (rating) values (3) $$,
  '42501', null, 'customers can''t write ratings directly'
);
reset role;

set local role anon;
select throws_ok($$ select count(*) from public.enquiries $$, '42501', null, 'anonymous visitors can''t read enquiries');
reset role;

select * from finish();
rollback;
