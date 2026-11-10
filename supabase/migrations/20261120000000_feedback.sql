-- Phase 5d: feedback the admin area reads (plan §4, §6.8 "Feedback").
-- The public forms that write these arrive in phase 6 (FREE-04, LEAD-01);
-- the tables come first so the admin page has somewhere to read from.
-- Written by the server only; admins read them.

-- FREE-04: the free checker's 1-5 rating with optional feedback.
create table public.tool_ratings (
  id uuid primary key default gen_random_uuid(),
  rating smallint not null check (rating between 1 and 5),
  feedback text check (feedback is null or length(feedback) <= 2000),
  -- Which tool or page asked, for example 'free-checker'.
  source text check (source is null or length(source) <= 100),
  -- Set when a signed-in user rated; most ratings are anonymous.
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.tool_ratings is
  'Ratings from the free checker (FREE-04). Written by the server only; admins read them.';

create index tool_ratings_created_at_idx on public.tool_ratings (created_at desc);

-- LEAD-01: qualification enquiries (docs/enquiry-qualification-spec.md).
create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (length(name) between 1 and 200),
  email text not null check (position('@' in email) > 1 and length(email) <= 254),
  company text check (company is null or length(company) <= 200),
  phone text check (phone is null or length(phone) <= 50),
  message text check (message is null or length(message) <= 10000),
  -- The structured answers ("qualification" in the spec).
  answers jsonb not null default '{}'::jsonb,
  -- Where the questionnaire ended, for example 'trial_standard_plus'.
  outcome text check (outcome is null or length(outcome) <= 100),
  source_page text check (source_page is null or length(source_page) <= 500)
);

comment on table public.enquiries is
  'Enquiries from the qualification form (LEAD-01). Written by the server only; admins read them.';

create index enquiries_created_at_idx on public.enquiries (created_at desc);

alter table public.tool_ratings enable row level security;
alter table public.enquiries enable row level security;

revoke all on public.tool_ratings, public.enquiries from anon, authenticated;
grant select on public.tool_ratings, public.enquiries to authenticated;

create policy "Admins read ratings"
  on public.tool_ratings for select to authenticated
  using ((select public.is_mintly_admin()));

create policy "Admins read enquiries"
  on public.enquiries for select to authenticated
  using ((select public.is_mintly_admin()));
