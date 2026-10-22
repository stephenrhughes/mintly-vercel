<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project rules

- The plan in `docs/rewrite-plan.md` is the source of truth for scope, data model and routes. Work follows its delivery phases (§11). Requirement IDs such as `TOOL-08` are defined in `docs/rewrite-requirements.md`; cite them in code comments and commits where relevant.
- `middleware.ts` is now `proxy.ts` in this Next.js version. Cache Components is on: anything reading cookies, headers or the session must sit behind `<Suspense>`.
- Keep private data on the server. API key values never reach the browser of a Member (plan §3, §6.2).
- Every Supabase table has RLS enabled and a pgTAP test in `supabase/tests`. Writes that touch Stripe, AWS or another user's data go through server code with an explicit permission check.
- All AWS SDK use lives in `src/lib/aws/` (plan §7).
- Before pushing, run `npm run check` and `npm run build`; run `npm run db:test` when migrations change.
