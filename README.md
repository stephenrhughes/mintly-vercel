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

Still to do for phase 0: Supabase staging and production projects, Vercel staging environment, and the AWS OIDC roles.

## Getting started

Requirements: Node 22 (`nvm use`), and Docker for the local database.

```bash
npm install
npm run dev            # http://localhost:3000
```

No environment variables are needed yet. See [`.env.example`](./.env.example) for the ones that exist.

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

## Project layout

```
docs/                  plan, requirements and specs
e2e/                   Playwright tests
src/app/               routes (App Router)
src/components/ui/     shadcn/ui components
src/components/site/   marketing site header and footer
src/lib/               shared logic (plan §2: seats, pricing, Stripe, AWS adapter, …)
supabase/              config, migrations and database tests
```

### Adding shadcn/ui components

`components.json` is set up, so `npx shadcn@latest add <component>` adds components to `src/components/ui`.

## Deploying to Vercel

1. In Vercel, **Add New… → Project** and import `stephenrhughes/mintly-vercel`. The defaults are right: framework Next.js, root directory `./`, build `npm run build`.
2. Deploy. No environment variables are needed yet.
3. Check `https://<deployment>/api/health` returns `{"status":"ok", …}`.

After that, every push to `main` deploys to production and every pull request gets a preview deployment. Node comes from `engines` in `package.json` (22.x) and the function region from `vercel.json` (`lhr1`, London).

Every deployment sends `X-Robots-Tag: noindex` and a `noindex` meta tag, so the new app can't compete with `www.mintly.uk` in search. At cut-over (plan §10.2), set `SITE_INDEXABLE=true` on production only.
