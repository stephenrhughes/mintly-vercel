# Setting up a hosted Supabase project

The database schema lives in `supabase/migrations` and is applied with `npm run db:push`. Some Auth settings can't be set by a migration and are made in the Supabase dashboard instead. Do both for each project (staging, then production).

`supabase/config.toml` holds the same settings for the local database (`npm run db:start`), so it is the reference for what the hosted projects should match.

## 1. Environment variables

In `.env.local` (local) and in Vercel (per environment):

| Variable | Where to find it | Used by |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL | The app |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys → Publishable key (or the legacy `anon` key, as `NEXT_PUBLIC_SUPABASE_ANON_KEY`) | The app |
| `SUPABASE_SECRET_KEY` | Project Settings → API Keys → Secret key (or the legacy `service_role` key, as `SUPABASE_SERVICE_ROLE_KEY`) | Server code only: the Stripe webhook, provisioning and admin actions. It bypasses RLS, so never prefix it with `NEXT_PUBLIC_`. |
| `SUPABASE_DB_URL` | Connect → Session pooler connection string, with the database password filled in | `npm run db:push` only. Don't add it to Vercel. |
| `NEXT_PUBLIC_APP_URL` | `https://app.mintly.uk` (production) or the staging app host. Leave unset on previews. | The app (requirements §15.4) |
| `SIGNED_IN_HINT_COOKIE_DOMAIN` | `.mintly.uk` on staging and production | The app (`APP-06`) |

Percent-encode any `@`, `#`, `/` or `:` in the database password inside `SUPABASE_DB_URL`.

## 2. Apply the migrations

```bash
npm run db:push:dry-run   # list what would be applied
npm run db:push           # apply it
npm run db:migrations     # compare local and remote migration history
```

The script reads `SUPABASE_DB_URL` from `.env.local` and runs `supabase db push --db-url …`. It never prints the password. Extra flags are passed through, for example `npm run db:push -- --include-all`.

To load the full work-email denylist (about 4,800 domains, `AUTH-04`) from `mintly-web`, generate a migration from its list and push it:

```bash
node scripts/import-email-denylist.mjs ../mintly-web/amplify/backend/function/mintlywebPreSignup/src/email-filter-denylist.js
npm run db:push
```

## 3. Auth settings in the dashboard

**Authentication → URL Configuration**
- Site URL: the app URL, for example `https://app.mintly.uk`.
- Redirect URLs: `https://app.mintly.uk/auth/callback`. For previews, also `https://*-<team>.vercel.app/app/auth/callback`. Locally: `http://localhost:3000/app/auth/callback`.

**Authentication → Hooks → Before User Created** (`AUTH-04`)
- Type: Postgres function. Schema `public`, function `hook_before_user_created`.

**Authentication → Sign In / Providers → Email**
- Confirm email: on (`AUTH-03`).
- Secure password change: off (the app asks for the current password itself, `ACC-03`).

**Authentication → Policies → Password** (`AUTH-02`)
- Minimum length 8. Required characters: lower case, upper case, digits and symbols.

**Authentication → Multi-Factor** (`SEC-01`)
- Authenticator app (TOTP): enabled for enrolment and verification. Mintly admins can't reach `/admin` without it.

**Authentication → Emails → Templates** (`AUTH-03`, `AUTH-12`)
- "Confirm signup": use `supabase/templates/confirmation.html`, subject "Confirm your Mintly account".
- "Reset password": use `supabase/templates/recovery.html`, subject "Reset your Mintly password".

Both templates contain the 6-digit code (`{{ .Token }}`) as well as the link, so they work when the email is opened in a different browser from the one that asked for it.

**Authentication → Emails → SMTP**: set up a sender (Resend, plan §5) before inviting real users. Supabase's built-in sender is heavily rate limited.

## 4. Per-environment sign-up exceptions

The hard-coded test bypass in the old sign-up (`AUTH-04`) is replaced by the `signup_allowlist` table. Add an exact email address or a whole domain, in the SQL editor of the project that needs it:

```sql
insert into public.signup_allowlist (entry, note) values ('qa.tester@gmail.com', 'QA account');
```

## 5. Make someone a Mintly admin

Until the admin area can do it (plan §6.8), in the SQL editor:

```sql
update public.profiles set is_mintly_admin = true where email = 'someone@mintly.uk';
```

They'll be asked to set up an authenticator app the first time they open `/admin`.
