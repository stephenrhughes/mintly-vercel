-- AUTH-07: Mintly is emailed once about each new user, when they confirm
-- their email. This records that the email has been sent, so a second
-- confirmation link or a later sign-in never sends it again. Set only by the
-- server (the column isn't in the profiles update grant).
--
-- The data migration (plan §10.1) must set this for every migrated user, or
-- their first sign-in through an emailed link would announce them as new.
alter table public.profiles add column admin_notified_at timestamptz;

comment on column public.profiles.admin_notified_at is
  'When Mintly was told about this new user (AUTH-07). Written only by the server.';
