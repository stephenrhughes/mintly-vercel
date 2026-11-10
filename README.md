# Mintly (Vercel)

The new Mintly website, customer portal and admin area: one Next.js app on Vercel, with Supabase for the database and auth. It replaces [`mintly-web`](https://github.com/stephenrhughes/mintly-web) (Amplify, Cognito, Lambdas). The Mintly APIs themselves stay on AWS.

The plan and design are in [`docs/rewrite-plan.md`](./docs/rewrite-plan.md), and the requirements it refers to (`TOOL-08` and so on) are in [`docs/rewrite-requirements.md`](./docs/rewrite-requirements.md).

## Status

**Phase 0: foundations** (plan §11). In place so far:

- Next.js 16 (App Router, Cache Components), TypeScript, Tailwind CSS 4 and shadcn/ui, with Mintly design tokens in `src/app/globals.css`
- A first home page, 404 page, `robots.txt` and `/api/health`
- Baseline security headers, and `noindex` on every deployment until cut-over
- Supabase project config, the first migration (`profiles` with RLS) and pgTAP tests
- Vitest unit tests, Playwright smoke tests and GitHub Actions CI
- `vercel.json` pinning functions to London (`lhr1`)

Still to do for phase 0: Vercel staging environment and the AWS OIDC roles.

**Phase 1: auth and organisations** (plan §11, requirements §15.4). In place so far:

- Sales site and app split by hostname in `src/proxy.ts` (`APP-01`–`APP-12`): the app is served from its own host when `NEXT_PUBLIC_APP_URL` is set, otherwise at `/app`
- Sign-up with work emails only, terms versions and marketing opt-out; email confirmation by code or link; sign-in; password reset; sign-out (`AUTH-*`, `LEGAL-01`)
- The app layout with its sidebar menu by role (`LAY-*`, `NAV-10`–`NAV-22`), Overview and Account settings (`ACC-01`–`ACC-03`)
- Authenticator-app MFA, required for the admin area (`SEC-01`)
- `organisations` and `memberships` with RLS, the `auth_org_id()` and `auth_role()` helpers, the sign-up denylist and its Auth hook, and pgTAP tests for each role

**Phase 4: teams and SSO** (plan §6.1, §6.6). In place:

- `/team` for everyone, with seats used against the limit; the owner invites by email with a role (Developer or Member), resends, withdraws, removes and changes roles (`TEAM-*`)
- Invites expire after 14 days, are held while a trial awaits review and sent on approval, and are checked against the seat limit in the database (`TEAM-03`, `TEAM-05`)
- `/join/<token>`: sign in or sign up with the invited email, and an explicit confirmation before anyone moves from another organisation (`JOIN-*`). Old `/join?invite=` links redirect
- **Sign in with SSO** on the sign-in page, behind reCAPTCHA v3; first-time SSO users join their tenant's organisation (`SSO-01`–`SSO-05`). Tenants are registered as in [`docs/supabase-setup.md`](./docs/supabase-setup.md) §6 and mapped on `/admin/sso`

**Phase 5: the admin area** (plan §6.8). In place, for Mintly admins who have completed MFA. Every write, and every failure, is recorded in `admin_audit`:

- `/admin`: trials awaiting review, counts by status, trials ending within 7 days, drift, past due, over the seat limit and over 80% of the allowance
- `/admin/organisations` and `/admin/organisations/<id>`: every customer from the database and Stripe together, with drift highlighted, resync from Stripe (preview, then apply), team and seats, key state in API Gateway (never the value), usage and the latest audit entries (`ADM-01`–`ADM-07`)
- On an organisation: change plan with any price, trial and proration options, now or at renewal (`PLAN-09`); extra seats (`PLAN-11`); extend a trial; cancel; suspend or reinstate; switch the key off (it stays off through Stripe events) or rotate it; manage the team, transfer ownership and allow invites from other domains
- `/admin/customers/new`: set up any customer, EISCD included, on any or a new custom price, by invoice (with an optional GoCardless mandate) or card, then invite the owner (`ADM-12`, plan §6.7)
- `/admin/view-as/<user>`: view the portal as a user sees it, read-only, for up to an hour, with a banner and Exit (`ADM-13`, `NAV-19`)
- `/admin/reports` (`ADM-14`), `/admin/plans` (`ADM-08`, `ADM-09`), `/admin/offers` (`ADM-11`; customers accept them in phase 7), `/admin/sso`, `/admin/admins` and `/admin/feedback`

## Getting started

Requirements: Node 22 (`nvm use`), and Docker for the local database.

```bash
npm install
npm run dev            # http://localhost:3000
```

Copy [`.env.example`](./.env.example) to `.env.local` and fill in the Supabase values. Without them the site still runs, but sign-in is unavailable. The app is at http://localhost:3000/app.

### Checks

```bash
npm run check          # lint, typecheck, format check and unit tests
npm run build
npm run test:e2e       # Playwright smoke tests against `npm run start` (build first)
```

Set `BASE_URL` to run the Playwright tests against a deployment instead, for example a Vercel preview.

### Database

The Supabase CLI is a dev dependency, so `npx supabase …` works without a global install.

```bash
npm run db:start       # local Supabase in Docker (Studio at http://localhost:54323)
npm run db:reset       # re-apply every migration and supabase/seed.sql
npm run db:test        # pgTAP tests in supabase/tests
npm run db:stop
```

New migrations: `npx supabase migration new <name>`, then edit the file in `supabase/migrations`. Every table gets RLS and a test in `supabase/tests` (plan §9).

To apply migrations to a hosted Supabase project, put its connection string in `.env.local` as `SUPABASE_DB_URL`, then:

```bash
npm run db:push:dry-run   # list the migrations that would be applied
npm run db:push           # apply them
npm run db:migrations     # compare local and remote history
```

Some Auth settings (the sign-up hook, redirect URLs, email templates, MFA) are set in the dashboard. See [`docs/supabase-setup.md`](./docs/supabase-setup.md).

## Project layout

```
docs/                  plan, requirements and specs
e2e/                   Playwright tests
src/app/               routes (App Router)
src/components/ui/     shadcn/ui components
src/components/site/   marketing site header and footer
src/app/app/           the app (sign-in, portal, admin), served from the app host (APP-02)
src/components/app/    the app layout and sidebar
src/lib/               shared logic (plan §2: seats, pricing, Stripe, AWS adapter, …)
src/lib/auth/          session and permission checks (the data access layer)
src/proxy.ts           host routing and session refresh
scripts/               database helper scripts
supabase/              config, migrations and database tests
```

### Adding shadcn/ui components

`components.json` is set up, so `npx shadcn@latest add <component>` adds components to `src/components/ui`.

## Deploying to Vercel

1. In Vercel, **Add New… → Project** and import `stephenrhughes/mintly-vercel`. The defaults are right: framework Next.js, root directory `./`, build `npm run build`.
2. Add the environment variables in [`docs/supabase-setup.md`](./docs/supabase-setup.md) §1 for each environment, then deploy.
3. Check `https://<deployment>/api/health` returns `{"status":"ok", …}`.

After that, every push to `main` deploys to production and every pull request gets a preview deployment. Node comes from `engines` in `package.json` (22.x) and the function region from `vercel.json` (`lhr1`, London).

Every deployment sends `X-Robots-Tag: noindex` and a `noindex` meta tag, so the new app can't compete with `www.mintly.uk` in search. At cut-over (plan §10.2), set `SITE_INDEXABLE=true` on production only.
