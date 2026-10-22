# Mintly web app: plan for the new application

**Status:** Draft 5. It adds trial approval (§6.11), self-serve plan changes (§6.12), the results of a gap review by role (§6.13), and running the old and new systems in parallel (§10.4). This builds on [`rewrite-requirements.md`](./rewrite-requirements.md), which records what the current app does. Requirement IDs used here (for example `TOOL-08`) refer to that document.
**Goal:** rebuild the Mintly website, customer portal and admin area as one Next.js app on Vercel, with Supabase for the database and auth. Keep everything customers rely on, fix the known gaps, and leave the APIs themselves on AWS.

---

## 1. Decisions

| # | Question | Decision | What it means for the build |
|---|---|---|---|
| Q1 | Roles | **Owner, Developer and Member** | Owner: billing, team and key. Developer: key, docs and usage. Member: tools and usage, and never sees the key. The owner picks a role when inviting. (§3) |
| Q2 | How the Tools page calls the API | **Through a server-side proxy** | The browser calls a Vercel route, and the server adds the key. The key never reaches a Member's browser, and checks can be logged per user. (§6.2) |
| Q3 | Usage data | **Nightly sync into Supabase** | A daily job copies `ApiDailyUsageStats` from DynamoDB into Postgres. Charts read only from Supabase. (§6.4) |
| Q4 | AWS Marketplace | **Retire it** | Delist the product. Drop the SQS handler, the Lambda and the Marketplace special case on the Tools page. (§10.3) |
| Q5 | EISCD customers | **Portal access for the key and usage** | Admins provision EISCD subscriptions in the admin area. Customers sign in to see their EISCD key, docs and usage. Still sold through a call; no online checkout. (§6.7) |
| Q6 | Auth provider | **Supabase Auth** | Email and password plus SAML SSO (paid Supabase plan). SSO tenants are registered with the Supabase CLI or API. (§6.1) |
| Q7 | Email | **Resend for transactional email; keep Brevo** | No email dependency on SES or AWS. Brevo stays for the marketing list. (§5) |
| Q8 | Admin scope at launch | **All four:** admins and teams, API key operations, subscription changes, SSO tenant set-up | These are on top of what already exists (customer list and detail, resync, plans health, audit). The `teamsEnabled` flag goes: every organisation has a team. (§6.8) |
| Q9 | The APIs themselves | **Stay on AWS** | The new app reaches AWS through one adapter module with a narrowly scoped IAM role. A later move would only change that module. (§7) |
| Q10 | Marketing site | **Same app, redesigned** | Port all public pages into the new app with a new design system, keeping every URL and redirect. (§6.10) |
| N1 | Scammers using free trials | **Admins approve new trials** | A new trial organisation stays *pending review*: no production key until an admin approves it. Trusted sign-ups are approved automatically. The 14 days start on approval. (§6.11) |
| N2 | Moving trial customers to a bigger plan | **Owners change plan themselves; admins in one click** | Owners can switch tier during the trial, start paying early, upgrade straight away, or downgrade at renewal. Admins use the same function with more options. (§6.12) |
| N3 | Gaps found by reviewing each role | **11 additions** | MFA for admins, terms versions, payment-failure notices, billing contacts, a clear message when a returning customer's key changes, a cancellation step, 24-month data retention, self-service key rotation, admin-created customers, view as customer, and a business dashboard. (§6.13) |

---

## 2. Architecture

```
                    ┌──────────────────────────── Vercel (lhr1, London) ────────────────────────────┐
 Browser ─────────► │ Next.js App Router                                                           │
 (public site,      │  • Marketing pages (static)          • Portal pages (server components)      │
  portal, admin)    │  • Route handlers /api/*             • Server actions                        │
                    │  • Vercel Cron jobs                                                          │
                    └───────┬──────────────┬──────────────┬──────────────┬──────────────┬─────────┘
                            │              │              │              │              │
                     Supabase (London)   Stripe       AWS adapter     Resend / Brevo   reCAPTCHA
                     • Postgres + RLS    • Checkout   (OIDC role)      • email           • public
                     • Auth (+ SAML)     • Portal     • API Gateway                        forms
                                         • Webhooks     keys, usage plans
                                                      • DynamoDB
                                                        ApiDailyUsageStats (read)
                                                                │
                                         api.mintly.uk / sandbox.mintly.uk (unchanged, on AWS)
```

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router), TypeScript | Server components for portal pages, so data is fetched on the server and nothing private reaches the client |
| UI | Tailwind CSS and shadcn/ui (proposed) | The redesign (Q10). Replaces Bootstrap 4, the Argon theme, reactstrap and Amplify UI. |
| Hosting | Vercel, London region (`lhr1`) | Preview deployment per PR; staging and production environments |
| Database | Supabase Postgres, London region | Row-level security (RLS) on every table; migrations kept in the repo (`supabase/migrations`) |
| Auth | Supabase Auth | Email and password, email verification, password reset, SAML SSO |
| Payments | Stripe (test and live), GoCardless | Same accounts and prices as today |
| AWS access | Vercel OIDC federation, assuming one IAM role | No long-lived AWS keys stored in Vercel |
| Email | Resend (transactional), Brevo (marketing list) | Templates written in code with React Email |
| Scheduled jobs | Vercel Cron | Calls protected `/api/cron/*` routes |
| Bot protection | Google reCAPTCHA (kept for now) | Server-side checks, as today |
| Analytics | GA4, Meta Pixel, gated by cookie consent | As today; the consent banner is redesigned |
| Support | Tawk.to chat, Cal.com booking | As today |
| Tests and CI | Vitest for unit tests, Playwright for end-to-end, GitHub Actions | Port the pure-logic tests that exist today (§9) |

The whole product is one repository and one deployable. Shared logic (seats, deriving a subscription record from Stripe, drift, pricing) lives in `lib/`, so the copying into each Lambda that `scripts/sync-lambda-shared.mjs` does today is no longer needed.

---

## 3. Roles and permissions

Each user belongs to at most one **organisation** (one per Stripe customer), with one role in it. Mintly admin is a separate flag on the user, not an organisation role.

| Capability | Owner | Developer | Member | Mintly admin |
|---|:-:|:-:|:-:|:-:|
| Web tools: single and bulk checks (`TOOL-*`) | ✓ | ✓ | ✓ | ✓ (any organisation, audited) |
| Download bulk results as CSV (paid plans) | ✓ | ✓ | ✓ | ✓ |
| View usage charts (`MON-*`) | ✓ | ✓ | ✓ | ✓ |
| View and copy the API key | ✓ | ✓ | ✗ | ✗ (state only, never the value) |
| Rotate the API key (§6.13) | ✓ | ✓ | ✗ | ✓ |
| Docs, specs, Postman, guides | ✓ | ✓ | ✓ (public anyway) | ✓ |
| View plan and status | ✓ | ✓ | ✓ | ✓ |
| Stripe billing portal, choose or change plan, accept an offer | ✓ | ✗ | ✗ | ✓ (change plan, §6.12) |
| Billing contacts, VAT number, PO reference; cancel (§6.13) | ✓ | ✗ | ✗ | ✓ |
| View the team | ✓ | ✓ | ✓ | ✓ |
| Invite, remove and change roles | ✓ | ✗ | ✗ | ✓ |
| Transfer ownership | ✗ (ask support) | ✗ | ✗ | ✓ |
| Admin area (§6.8) | ✗ | ✗ | ✗ | ✓ |

Rules:
- An organisation has exactly **one owner**. The person who completes checkout becomes the owner (`PROV-01`). Ownership changes only through an admin action, which is audited.
- **Every role takes a seat.** Seat limit = `max_team_size + extra_users`, owner included; pending invites count (`TEAM-03`).
- Existing team members are migrated as **Member**, and owners as **Owner**. Owners can then promote developers.
- Users who sign in through SSO join as **Member** by default (tenant setting, §6.1).

---

## 4. Data model (Supabase Postgres)

All tables live in `public` with RLS enabled. Helper SQL functions such as `auth_org_id()`, `auth_role()` and `is_mintly_admin()` keep the policies short. Writes that touch Stripe or AWS, or another user's data, go through server code using the service role, after an explicit permission check.

| Table | Key columns | Notes and RLS |
|---|---|---|
| `profiles` | `id` (= `auth.users.id`), `email`, `first_name`, `last_name`, `phone`, `company_name`, `marketing_opt_out`, `terms_accepted_at`, `terms_version`, `privacy_version`, `is_mintly_admin`, `legacy_cognito_sub` | A user reads and updates their own row, except `is_mintly_admin`, which only the server writes |
| `organisations` | `id`, `name`, `stripe_customer_id` (unique), `created_at`, `review_status` (`pending_review` / `approved` / `rejected` / `suspended`), `reviewed_by`, `reviewed_at`, `review_note`, `signup_signals` (jsonb, §6.11), `billing_emails` (text[]), `po_reference`, `ended_at`, `cancellation_reason`, `purge_after`, `purge_notice_sent_at` (§6.13) | Members read their own organisation, except `review_note` and `signup_signals`, which only admins read |
| `trusted_domains` | `domain` (unique), `reason`, `added_by`, `added_at` | Trial sign-ups from these domains are approved automatically (§6.11). Admin only. |
| `blocked_domains` | `domain` (unique), `reason`, `added_by`, `added_at` | Added to the built-in work-email denylist; sign-up is refused. Admin only. |
| `plan_changes` | `id`, `org_id`, `actor_id`, `actor_kind` (`owner` / `admin`), `from_price_id`, `to_price_id`, `kind` (`trial_switch` / `start_paid` / `upgrade` / `downgrade_scheduled` / `admin_change`), `effective_at`, `stripe_schedule_id`, `amount_due_now`, `status` (`done` / `scheduled` / `cancelled` / `failed`), `created_at` | History of every plan change (§6.12). Owners read their organisation's rows; admins read all. |
| `memberships` | `org_id`, `user_id` (unique: one organisation per user), `role` (`owner` / `developer` / `member`), `joined_at` | Members read their organisation's memberships; written only by the server |
| `invitations` | `id`, `org_id`, `email`, `role`, `token_hash`, `invited_by`, `created_at`, `expires_at`, `accepted_at`, `revoked_at` | Owners read their organisation's invitations; written only by the server |
| `subscriptions` | `id`, `org_id`, `product` (`bank_checker` / `eiscd`), `stripe_subscription_id`, `stripe_subscription_item_id`, `stripe_price_id`, `status`, `trialing`, `current_period_end`, `cancel_at`, `expired`, `max_team_size`, `extra_users`, `usage_plan_id`, `api_key_id`, `updated_from_stripe_at` | One live subscription per organisation and product. Members read their own (never the key value, which isn't stored). Derived from Stripe (`subscriptionRecord` logic). |
| `api_keys` | `id` (= API Gateway key ID), `org_id`, `product`, `enabled`, `usage_plan_id`, `created_at`, `rotated_from` | Never stores the key **value**; owners and developers get it from API Gateway on demand (§7) |
| `usage_daily` | `api_key_id`, `date`, `success`, `not_found`, `synced_at` | Filled nightly (§6.4); members read rows for their organisation's keys |
| `check_log` | `id`, `org_id`, `user_id`, `at`, `kind` (`sortcode` / `account` / `iban` / `swift`), `mode` (`single` / `bulk`), `outcome` (`valid` / `invalid` / `rate_limited` / `error`) | Per-user audit of Tools use. **Never stores sort codes, account numbers, IBANs or BICs.** Owners read their organisation's rows. |
| `offers` | `id`, `org_id` or `email`, `stripe_price_id`, `headline`, `message`, `expires_at`, `accepted_at`, `revoked_at`, `created_by` | One model for the admin and the customer (fixes the gap in requirements §5.4) |
| `sso_domains` | `domain` (unique), `org_id`, `supabase_sso_provider_id`, `default_role`, `enabled` | Admin only; the sign-in lookup goes through the server |
| `stripe_events` | `id` (= Stripe event ID), `type`, `received_at`, `processed_at`, `error` | Makes webhook handling idempotent (`NFR-04`) |
| `admin_audit` | `id`, `at`, `actor_id`, `target_org_id`, `action`, `before`, `after`, `details` | Admin read only; every admin write, every proxied admin check, every view-as session and every key rotation |
| `free_check_limits` | `ip_hash`, `week_start`, `count`, `last_at` | Rate limit for the public checker (`FREE-03`); stores a hash, not the raw IP |
| `tool_ratings`, `enquiries` | as today | Written by the server only; admins read them |

Plans and prices are **not** copied into the database. Stripe price metadata stays the source of truth (`ADM-10`), cached in memory on the server.

---

## 5. Integrations

| Integration | Used for | Implementation |
|---|---|---|
| Stripe | Checkout, billing portal, subscription webhooks, metered usage, admin subscription changes | `stripe` Node SDK; webhook at `/api/webhooks/stripe` (signature verified, recorded in `stripe_events`) |
| GoCardless | Collecting `send_invoice` invoices by direct debit (`BILL-04`) | Handled by `/api/webhooks/stripe` on `invoice.finalized`; logic ported from `paymentHelpers.js` |
| AWS API Gateway | Create, enable, disable, move and rotate keys; read the key value; check usage plans | AWS adapter (§7) |
| AWS DynamoDB `ApiDailyUsageStats` | Usage sync | AWS adapter, nightly job only |
| Resend | Invite, "added to team", payment failed, invoices to billing contacts, new API key (returning customer or rotation), data deletion notice, new-customer and new-user notices to admins, trial review (pending, approved, declined, more information needed; admin notice and reminder), trial ending reminders, plan change confirmations, enquiry auto-reply, offer emails | React Email templates in `emails/` |
| Brevo | Marketing list: add on subscribe (unless opted out), update when a trial converts, remove on cancel; email capture | Ported from `brevoHelpers.js` |
| reCAPTCHA | Free checker, enquiry, SSO lookup | Server-side check, including the hostname |

Secrets live in Vercel environment variables, separate for production and staging: Stripe keys and webhook secrets, GoCardless, Resend, Brevo, reCAPTCHA, the free-checker trial API key, and the AWS role ARN. Preview deployments use only test-mode and staging values.

---

## 6. Features

### 6.1 Sign-up, sign-in and SSO (`AUTH-*`, `SSO-*`, `ACC-*`)

- **Pages:** `/sign-in`, `/sign-up`, `/forgot-password`, `/auth/callback`, with Supabase Auth and server-side sessions (`@supabase/ssr`). Protected pages redirect to `/sign-in?next=…` instead of showing the form in place. Plan intent (`BUY-02`) travels in `next` and the stored plan slug.
- **Work emails only** (`AUTH-04`): the domain denylist moves into a Supabase "before user created" Auth hook, or a Postgres function the hook calls. The message stays the same. The hard-coded test bypass is replaced by an allow-list that can be set per environment.
- **T&C acceptance and marketing opt-out** (`AUTH-05`, `AUTH-06`) are captured on sign-up and stored on `profiles`.
- **Admin notice for each new user** (`AUTH-07`): a database trigger or the sign-up handler sends a Resend email to `info@mintly.uk`.
- **MFA** (`SEC-01`): Supabase Auth TOTP (authenticator app). Required for Mintly admins: the admin area refuses a session that hasn't completed MFA. Optional for customers, from `/app/account`.
- **Terms versions** (`LEGAL-01`): the terms and privacy pages each carry a version string; sign-up stores the versions accepted. Changes are announced by email.
- **Password policy** (`AUTH-02`): set in Supabase (at least 8 characters with lower case, upper case, number and symbol), plus the friendly messages on the client.
- **SSO** (`SSO-01`–`SSO-05`):
  - "Sign in with SSO" takes an email, checks reCAPTCHA, looks up `sso_domains` on the server, and calls `signInWithSSO({ domain })`.
  - On first sign-in, a server step links the user to the domain's organisation with the tenant's `default_role`, but only while the organisation has a live subscription.
  - Seat limits are still not enforced for SSO users. The admin view flags any team over its limit.
- **SSO tenant set-up** (`SSO-07`, Q8): the admin area records the domain, organisation and default role. Registering the identity provider itself is a documented Supabase CLI or API step (`supabase sso add …`). A later phase could call the Supabase Management API from the admin area.
- **Account deletion** (`ACC-04`, gap fixed): allowed only when the user is not an owner of a live subscription. It deletes the auth user and profile, removes their membership, removes them from Brevo, and is recorded in the audit log. Owners must ask support, who transfer ownership or close the organisation.

### 6.2 Web tools (`TOOL-*`, Q2)

- **Pages:** `/app/tools`, with single checks (sort code and account, IBAN, SWIFT) and bulk checks (paste, or a `.txt`/`.csv` file up to 1 MB, in the same four formats).
- **Proxy:** `POST /api/check` takes `{kind, value(s)}`. It:
  1. checks the session and membership, and that the organisation is **approved** (§6.11) and has a live Bank Account Checker subscription. A pending organisation is routed to the sandbox instead;
  2. reads the organisation's key value (cached on the server for a short time; never sent to the client);
  3. calls `api.mintly.uk/bankAccount/v1` and returns the API response as it came;
  4. writes a row to `check_log` (no bank details stored).
- **Bulk:** the client sends chunks of up to 25 lines to `POST /api/check/batch`. The server works through each chunk, pacing the calls to the plan's throttle (Starter and trial slow, higher plans faster, as `TOOL-09`). The progress bar, per-line errors and the paid-only CSV download stay (`TOOL-10`, `TOOL-11`). Quota and rate-limit messages stay (`TOOL-12`).
- Each result shows the matching API call, and the code samples stay (`TOOL-07`, `TOOL-13`). Members see the endpoint path, with a placeholder instead of the key.

### 6.3 Dashboard and subscription (`SUB-*`, `API-*`)

- **Pages:** `/app` (overview) and `/app/subscription`.
  - Plan name, status and trial or renewal date. For owners and developers, the API key with copy and a warning to keep it secret.
  - Links to the Postman collection, docs and sandbox.
- A subscription is active when it hasn't expired **and** the key is enabled (`SUB-02`). The key value is read from API Gateway only when an owner or developer opens the page.
- An organisation with both products sees both cards (§6.7).

### 6.4 Usage (`MON-*`, Q3)

- **Nightly job** (`/api/cron/usage-sync`, around 03:00 UK time):
  - For every key in `api_keys`, query `ApiDailyUsageStats` for the last 3 days (to pick up late writes) and upsert into `usage_daily`.
  - On first run, backfill 2 years.
- **Page:** `/app/usage` shows the same chart, date ranges, totals, estimated saving and projection as today (port `monitoringLogic.js`). A note says the figures are updated daily.
- The Tools page also shows a per-user count for the period from `check_log`. Owners see a breakdown by person.

### 6.5 Plans, checkout and billing (`BUY-*`, `PROV-*`, `BILL-*`, `OFF-*`)

- **Plan selection** (`BUY-01`, `BUY-02`): the pricing page links to `/app/subscribe?plan=<slug>`; plan intent survives sign-up. Plan display data stays in code (`plans.ts`); price IDs come from Stripe metadata (`tier`, `interval`).
- **Checkout** (`BUY-03`–`BUY-06`): a server action creates the Stripe Checkout session. The rules are unchanged:
  - a 14-day trial with no card for new customers
  - automatic tax and promotion codes
  - a 409 if a live subscription already exists, unless the user is accepting an offer. The 409 screen now sends the owner to **Change plan** (§6.12) instead of telling them to contact support.
  - conversion tracking on `/app/welcome`
  - a new trial organisation starts as **pending review** unless a rule approves it automatically (§6.11)
- **Webhook** (`/api/webhooks/stripe`):
  - Store the event ID first and skip duplicates (`NFR-04`).
  - Derive the subscription row from Stripe using the ported `deriveSubscriptionRecord`.
  - Apply the key actions through the AWS adapter: create on checkout, move when the plan changes, disable when the subscription ends. **A pending-review organisation gets no key until it is approved;** approval runs the same provisioning step (§6.11).
  - Write the database last, then send email and update Brevo.
  - The "Automatically cancelled by upgrading" rule (`PROV-07`) stays.
  - EISCD prices are recognised by their price metadata (`product=eiscd`), not a hard-coded ID.
- **Billing portal:** owner only (`BILL-01`).
- **Metered overage** (`BILL-05`): `/api/cron/metering` runs daily. It reports yesterday's usage from `usage_daily` to Stripe for metered subscription items, using Stripe's current meter events API. The list of plans comes from price metadata, not hard-coded IDs.
- **GoCardless** (`BILL-04`): ported unchanged.
- **Offers** (`OFF-*`, gap fixed):
  - An admin creates an offer for an organisation or an email address by choosing a Stripe price (often a custom one) and an expiry, plus an optional message. The customer is emailed.
  - The customer sees the offer on `/app/subscription` and accepts it through Checkout with `replaceExisting`.
  - The webhook marks it accepted. Admins can revoke an offer, and expired offers drop out of view.

### 6.6 Team (`TEAM-*`, `JOIN-*`, Q1)

- **Page:** `/app/team`, shown to every organisation; the `teamsEnabled` flag is dropped.
  - Lists members with their role, and pending invites with their expiry.
  - Shows "X of Y seats used".
- **Invites** (owner only):
  - Enter an email and a role (Developer or Member).
  - The same-domain rule stays, but an admin can override it per organisation for partners or contractors.
  - Seats are checked on the server (`TEAM-05`).
  - The invite is sent with Resend and **expires after 14 days** (gap fixed).
- **Accepting** (`/join/<token>`):
  - The invitee signs up or signs in with the invited email, which must match (`JOIN-02`).
  - **An existing user is never moved without consent.** They see an "accept invitation to X" screen. If they already belong to another organisation, they are warned that accepting will move them, and asked to confirm. (Gap fixed: today `TEAM-06` moves them automatically.)
  - Seats are re-checked against accepted members (`JOIN-04`).
- **Remove, revoke and change role:** owner only. The owner can't remove themselves (`TEAM-08`). Removing someone deletes their membership; they keep their login but lose access.

### 6.7 EISCD (Q5)

- An EISCD subscription is a row in `subscriptions` with `product = eiscd` and its own API key in `api_keys`.
- **Provisioning** (admin, through **Set up a customer**, §6.8):
  1. Choose or create the organisation and choose the EISCD price (weekly or monthly).
  2. The app creates the Stripe subscription (send-invoice billing) and the API Gateway key in the EISCD usage plan.
  3. The app emails the owner an invite.
- **Existing manually provisioned EISCD keys** are imported during migration and linked to their organisations.
- The customer sees an EISCD card on the dashboard (key, plan, renewal date, links to `/eiscd-docs`) and the usage chart for that key.
- There is still no online checkout for EISCD.

### 6.8 Admin area (`ADM-*`, Q8)

Under `/admin`, available only to users with `is_mintly_admin`, checked on the server for every request. Every write is recorded in `admin_audit`.

| Area | Features |
|---|---|
| **Trial reviews** | Queue of pending organisations with sign-up signals; approve, ask for information, decline; manage trusted and blocked domains (§6.11) |
| **Overview** | Trials awaiting review (count and oldest wait), counts by status, trials ending within 7 days, organisations with drift, and organisations over their seat limit or over 80% of quota (from `usage_daily`) |
| **Organisations** | List with search, filters and sorting (`ADM-01`, `ADM-02`). Detail page (`ADM-03`): database next to Stripe with drift highlighted, subscriptions, team, key state, usage chart, audit history. |
| **Resync from Stripe** | Preview, then apply (`ADM-05`, `ADM-06`), ported from `resync.js` |
| **Subscription changes** | Change price or billing interval through the shared `changePlan()` with a preview (§6.12), set extra seats, extend a trial, cancel now or at period end, suspend or reinstate. Each change is written to Stripe; the webhook and a follow-up resync update the database. |
| **Set up a customer** (`ADM-12`) | Create an organisation for any product: choose any price (including custom), card or invoice billing (with optional GoCardless mandate ID), seats and extra users, an optional trial, then invite the owner. Approved automatically. EISCD provisioning (§6.7) is one case of this. |
| **View as customer** (`ADM-13`) | Open the portal as a chosen user, read-only, with a banner showing who is being viewed. The key value is hidden and every action is disabled. Each session is audited. |
| **Business dashboard** (`ADM-14`) | Sign-ups, trials pending, approved and declined, time to approve, trial-to-paid conversion, cancellations with reasons, and recurring revenue by plan (from Stripe, cached daily) |
| **API key operations** | Enable or disable a key; **rotate** it (create a new key in the same usage plan, update the subscription and `api_keys`, disable the old key after an optional grace period, email the owner) |
| **Team management** | Add or remove members, change roles, revoke invites, transfer ownership, allow invites from other domains |
| **Admins** | Grant or revoke Mintly admin (and never remove the last admin) |
| **SSO** | Manage `sso_domains` (domain, organisation, default role, enabled), with a checklist of the Supabase CLI steps |
| **EISCD provisioning** | §6.7 |
| **Plans** | Plan catalogue health (`ADM-08`, `ADM-09`) |
| **Offers** | Create, list, revoke, and see status (pending, accepted, expired) |
| **Feedback** | Read-only lists of tool ratings and enquiries |

### 6.9 Public free checker and lead capture (`FREE-*`, `LEAD-*`)

- `POST /api/free-check`:
  - Checks reCAPTCHA (including the hostname) and the origin.
  - Enforces the rate limit in `free_check_limits`: 10 checks per IP per week and at least 2 seconds apart, done as a single atomic upsert.
  - Calls the API with the trial key held as a server environment variable (**rotate the key that is in source today**).
  - Returns VALID or INVALID and the bank name only.
- The rating prompt after 3 checks and the offer from the 8th stay; ratings go to `tool_ratings`.
- **Enquiry questionnaire:** ported (`enquiryQualification` logic). Submissions are stored in `enquiries` and emailed with Resend, with an auto-reply.
- **Email capture:** adds the address to Brevo.

### 6.10 Marketing site and docs (`WEB-*`, `DOC-*`, Q10)

- Every public page is ported into the new design system and statically generated:
  - home, features, the product pages, pricing and calculator, get-started, ai-agents, about, FAQ
  - the 11 articles and 7 integration guides
  - release notes and the legal pages
- Articles, guides and release notes move to MDX files so they're easier to edit.
- **URLs stay exactly the same**, and every redirect in `next.config.mjs` is carried over (`WEB-03`). A test compares the old and new sitemaps and fails on any missing URL.
- SEO (`WEB-02`) uses Next metadata: title, description, canonical, Open Graph, JSON-LD (ported from `StructuredData.js`), and `noindex` on `/app/*` and `/admin/*`.
- The API docs (ReDoc), spec downloads, agent-skill zips and Postman collection stay (`DOC-*`), including the OpenAPI sync and lint at build time.
- Security headers and CSP go in `next.config` (`WEB-04`). The CSP is updated for Supabase, Resend (none needed in the browser) and the remaining third parties.

### 6.11 Trial approval (N1, `APPR-*`)

**Problem:** anyone with a work-looking email can start a 14-day trial and get a production API key straight away. Scammers use this, and today the only protections are the email-domain denylist and the trial usage plan's daily limit.

**Approach:** sign-up stays open, but a new **trial** gets no production access until a Mintly admin approves the organisation. Trusted sign-ups skip the queue, so genuine customers aren't held up.

**When review applies:**

| Situation | Review? |
|---|---|
| New organisation starts a free trial | **Yes**, unless an auto-approve rule matches |
| Email domain is in `trusted_domains`, or matches an existing approved organisation or an SSO tenant | No, approved automatically, with the reason recorded |
| Returning Stripe customer (an existing organisation) checks out again | Keeps the organisation's existing status. A rejected or suspended organisation can't check out. |
| User joins an approved organisation by invite or SSO | No. The organisation is already approved. |
| Offer accepted, or EISCD provisioned by an admin | No. An admin is already involved. |
| Organisations migrated from the current platform | No. All start as approved. |

Card details play no part in approval. Every new customer starts on a free trial (`BUY-03`), and Stripe doesn't take card details for a free trial, so there is no card or fraud score to go on at the point of review.

**What happens at checkout:**
1. The Stripe trial subscription is created as today.
2. The webhook records it and stores the sign-up signals (below), then sets the organisation to `pending_review`. **No API key is created.**
3. The owner lands on `/app/welcome` with a "We're reviewing your account" message. It says reviews usually take less than one working day, and gives the support email.
4. Admins get an email: "New trial awaiting review: <company>, <email>", linking to the review page.

**What a pending user can do:** sign in, edit their profile, invite colleagues (invites are held and sent on approval), read the docs and guides, and use the Tools page in **sandbox mode** (calls `sandbox.mintly.uk` with a Mintly-held sandbox key and the published test values; clearly labelled). They can't see a production key, and the Tools page can't make production checks.

**Admin review page** (`/admin/reviews`): a queue of pending organisations, oldest first, with the signals for each:
- the email domain, and whether it has a website and mail (MX) records
- the company name entered, and whether it matches the domain
- previous trials from the same domain, the same email, or the same sign-up IP (the main abuse pattern is repeated trials)
- sign-up country and IP (from Vercel's request headers), and whether the IP is a known hosting or VPN range, if a lookup service is added
- the phone number, if given, and the plan chosen

**Admin actions:**

| Action | Effect |
|---|---|
| **Approve** | Status `approved`. Create the key in the trial usage plan (the normal provisioning step). **Reset the Stripe trial end to now + 14 days**, so time spent waiting isn't lost. Send held invites. Email the owner "You're approved" with the key link. Option: also add the domain to `trusted_domains`. |
| **Ask for information** | Email the owner a templated request (for example "please reply with your company website and how you'll use Mintly"). Status stays pending; the note is recorded. |
| **Decline** | Status `rejected`. Cancel the Stripe subscription immediately (no charge, as no card is held). Send a short, polite decline email that gives no reason. Option: add the domain to `blocked_domains`. |
| **Suspend** (an approved organisation, later) | Status `suspended`. Disable the key, block Tools and record why. Reversible with **Reinstate**. |

**Safety nets:**
- If a trial is still pending after 4 working hours, admins get a reminder. After 7 days it is declined automatically, with a "your request expired, contact us" email.
- The admin overview shows the number pending and the oldest wait.
- Every action goes in `admin_audit`.
- The trial usage plan's daily limit stays as a second line of defence after approval.

### 6.12 Changing plan (N2, `PLAN-*`)

**Problem:** customers start a Starter trial, find they need more, and are stuck. Today a trial customer who picks another plan gets a "you already have a subscription" error, and the dashboard tells them to contact support. Support then edits Stripe by hand.

**Approach:** a **Change plan** page for owners (`/app/subscription/change`). Admins get the same action in the admin area. Both call one server function, `changePlan()`, which updates the existing Stripe subscription (never a second checkout). The webhook already moves the API key to the new plan's usage plan (`PROV-05`), and the key never changes, so integrations keep working.

**The page shows:**
- the three tiers with monthly and annual prices, the current plan marked
- a **recommended plan** worked out from the organisation's usage so far (projected monthly checks from `usage_daily`, using the ported price calculator) and from team size
- for the selected option, exactly what happens: what is charged today, from when, and what the next invoice will be. These figures come from Stripe's invoice preview, so the page and the invoice agree.

**What each change does:**

| Current state | Change | What happens |
|---|---|---|
| Trial | **Switch tier** (up or down) | Price swapped with no charge. The trial carries on with the same end date. The key moves to the new tier's trial usage plan. No card needed. |
| Trial | **Start paid plan now** (any tier and interval) | If there's no card on file, the owner adds one first (Stripe Checkout in setup mode), then returns. The trial ends now, the first invoice is charged, and the key moves to the paid usage plan, which lifts the trial's daily limit. |
| Trial, near its end | Nothing chosen | Reminder emails 7, 3 and 1 days before the trial ends, plus a banner, each linking to Change plan. (Today the trial simply cancels if no card is added.) |
| Paid | **Upgrade** (higher tier, or monthly to annual) | Takes effect at once. The charge is **prorated**: Stripe credits the unused part of the old plan and charges the difference straight away (the exact amount is shown first). The key moves to the new usage plan. |
| Paid | **Downgrade** (lower tier, or annual to monthly) | Scheduled for the end of the current period (a Stripe subscription schedule), with no refund. The subscription page shows "Changes to Starter on 1 December", with an option to cancel the change. |
| Any | Downgrade below the team size | Blocked, with a message such as "Starter includes 1 seat and your team has 4; remove 3 people first", listing the team. |
| Any | Downgrade below current usage | Allowed, with a warning that their recent usage would exceed the new allowance and incur overage. |
| Custom or legacy price | Any | Legacy prices can move to a current plan. Custom (enterprise) prices show "Contact us to change your plan". |
| Over 50,000 checks a month | Any | "Talk to us" (enquiry and booking), as on the pricing page. |

**Prompts to change plan:**
- Tools: when the trial daily limit or the plan quota is hit, owners see an **Upgrade** button. Others see "Ask your account owner to upgrade", with a one-click "Notify my owner" email.
- Team: the "Your team is full" message offers **Upgrade** to a plan with more seats, or **Contact us** for extra seats.

**Extra seats can't be bought by customers.** Only admins set them (`extra_users`, from the admin area, §6.8). Owners who need more seats either upgrade to a tier with more, or ask Mintly.
- Usage: a banner when projected usage for the period is above the plan allowance, with the recommended plan.

**Rules:**
- Owner only for customers. Every change is recorded in `plan_changes`, and admin changes also go in `admin_audit`.
- One pending scheduled change at a time; a new change replaces it.
- Each Stripe call uses an idempotency key, so a double click can't make two changes.
- A pending-review organisation can switch tier during its trial, but **Start paid plan now** appears only once it is approved. That way nobody pays for access they can't use yet, and a declined organisation never needs a refund.
- Owners get a confirmation email for every change.

**Admin version** (organisation detail page): the same preview, plus options customers don't have: any price including custom ones, keep or end the trial, extend the trial, choose proration (none, credit, or charge now), and apply immediately rather than at renewal.

### 6.13 Additions from the gap review (N3)

The plan was reviewed from the point of view of each role: member, owner, developer and admin. These are the additions agreed; the requirement IDs are in requirements §15.3, which also lists what was considered and left out.

**Everyone**
- **MFA for admins** (`SEC-01`) and **terms versions** (`LEGAL-01`): see §6.1.

**Owners: billing**
- **Failed payments** (`BILL-06`):
  - On `invoice.payment_failed`, email the owner and billing contacts with a link to update the card (a Stripe portal session), and show a banner in the portal until the invoice is paid.
  - The key stays live. If Stripe's retries all fail and it cancels the subscription or marks it unpaid, the normal end-of-subscription path disables the key (`PROV-07`).
  - Past-due organisations appear in the admin overview and list filter.
- **Billing contacts** (`BILL-07`): on `/app/billing` the owner manages:
  - **Billing emails.** The app emails each one the hosted invoice link and PDF on `invoice.finalized`, `invoice.paid` and `invoice.payment_failed`, so this doesn't rely on Stripe's single customer email.
  - **VAT number**, stored as a Stripe customer tax ID so it appears on invoices.
  - **PO reference**, stored as an invoice custom field on the Stripe customer.
  - Billing contacts can't sign in and take no seat.
- **Returning customers** (`BILL-08`): as today, a customer who subscribes again gets a new key and the old one stays disabled. The new app tells them: the owner and developers are emailed "You have a new API key; your previous key no longer works", and the subscription page shows the same notice until it is dismissed.
- **Cancelling** (`CANC-01`): **Cancel subscription** opens `/app/subscription/cancel`:
  1. An optional reason (a short list plus free text), stored in `organisations.cancellation_reason` and shown on the admin business dashboard.
  2. What will happen: the key works until the end of the period (with the date), data is kept for 24 months, and resubscribing later means a new key.
  3. Continue to Stripe's own cancellation flow (a billing portal session opened straight at the cancel step).

**Owners: data**
- **Retention** (`RET-01`):
  - When a subscription ends for good, `ended_at` is set and `purge_after` is set to 24 months later.
  - The daily `retention` job emails the owner 30 days before `purge_after`.
  - On the date it deletes the organisation's users (auth and profile), memberships, invitations, `check_log`, `usage_daily`, offers and billing contacts, and removes the users from Brevo.
  - It keeps a minimal organisation record (ID, Stripe customer ID, dates) and the admin audit entries.
  - Resubscribing before the date clears `purge_after`.

**Developers**
- **Key rotation** (`KEY-01`):
  - Owners and developers can choose **Rotate key** on the subscription page.
  - They choose **now** (the old key is disabled at once) or **in 24 hours** (both keys work in the meantime).
  - A new key is created in the same usage plan; `api_keys` and the subscription point at it, and `rotated_from` records the old key.
  - The owner is always emailed, and the rotation is recorded in `admin_audit` (which records customer key rotations as well as admin actions).
  - The Tools proxy switches to the new key at once.
  - During an overlap, both keys' usage counts towards the organisation in the usage charts and in metering.
  - Admins can still rotate keys from the admin area.

**Admins**
- **Set up a customer** (`ADM-12`), **view as customer** (`ADM-13`) and **business dashboard** (`ADM-14`): see §6.8.

---

## 7. AWS adapter

All AWS calls go through `lib/aws/`. Nothing else imports the AWS SDK.

```
lib/aws/apiKeys.ts     createKey(orgId, usagePlanId) · getKeyValue(keyId) · enableKey · disableKey
                       moveKey(keyId, fromPlan, toPlan) · rotateKey(keyId) · getKeyPlans(keyId)
lib/aws/usagePlans.ts  listUsagePlans() · getUsagePlan(id)
lib/aws/usageStats.ts  readDailyStats(keyId, fromDate, toDate)   // ApiDailyUsageStats
```

**Credentials:** Vercel OIDC federation. Each Vercel environment assumes its own IAM role (`mintly-web-staging` or `mintly-web-production`). There are no stored access keys.

**IAM permissions:** the minimum needed.
- `apigateway:GET`, `POST`, `PATCH` and `DELETE`, on `/apikeys*` and `/usageplans*` only
- `dynamodb:Query` on `ApiDailyUsageStats` only

If the APIs ever move off AWS (Q9), only these three files change.

---

## 8. Routes

**Public:**
- `/`, the marketing pages, `/docs`, `/eiscd-docs/*`
- `/pricing`, `/sign-in`, `/sign-up`, `/forgot-password`, `/auth/callback`, `/join/[token]`

**Portal** (signed in, with a membership):

| Route | Who |
|---|---|
| `/app` | Everyone |
| `/app/tools` | Everyone |
| `/app/usage` | Everyone |
| `/app/subscription` | Everyone; the key is shown only to owners and developers, and only once the organisation is approved |
| `/app/subscription/change` | Owners |
| `/app/subscription/cancel` | Owners (reason and consequences, then the Stripe portal) |
| `/app/billing` | Owners: billing contacts, VAT number, PO reference |
| `/app/team` | Everyone; changes are owner-only |
| `/app/account` | Everyone |
| `/app/subscribe` | Users with no live subscription |
| `/app/welcome` | After checkout |

**Admin:** `/admin`, `/admin/reports`, `/admin/reviews`, `/admin/customers/new`, `/admin/view-as/[userId]`, `/admin/organisations`, `/admin/organisations/[id]`, `/admin/plans`, `/admin/offers`, `/admin/sso`, `/admin/admins`, `/admin/feedback`

**API route handlers:**

| Route | Purpose |
|---|---|
| `POST /api/check`, `POST /api/check/batch` | Tools proxy |
| `POST /api/free-check` | Public checker |
| `POST /api/enquiry`, `POST /api/email-capture`, `POST /api/rating` | Lead capture |
| `POST /api/sso/lookup` | SSO domain lookup |
| `POST /api/webhooks/stripe` | Stripe events, including GoCardless collection |
| `GET /api/cron/usage-sync`, `GET /api/cron/metering`, `GET /api/cron/reminders` | Vercel Cron, protected by `CRON_SECRET`. `reminders` runs hourly: trial-ending emails, review reminders, and declining reviews older than 7 days. `GET /api/cron/retention` runs daily: 30-day notices and the 24-month purge (§6.13). |

Everything else (profile updates, invites, checkout, admin actions) uses server actions, with the permission check at the top of each one.

**Old portal paths redirect** to their new homes:

| Old path | New path |
|---|---|
| `/dashboard` | `/app` |
| `/tools` | `/app/tools` |
| `/monitor` | `/app/usage` |
| `/admin` | `/admin` |
| `/join?invite=` | `/join/[token]` (legacy tokens honoured until they are migrated) |
| `/success` | `/app/welcome` |

---

## 9. Security, quality and operations

- **Authorisation:**
  - RLS on every table, plus a role check in every server action and route handler.
  - Tests cover each role against each action, using the matrix in §3.
- **Secrets:** stay on the server; separate per environment; the free-checker key is rotated at launch.
- **Personal data:**
  - `check_log` stores no bank details.
  - IPs are hashed.
  - Data is stored in London (Supabase and Vercel).
  - Deletion follows §6.1.
- **Idempotency:** Stripe events are deduplicated; key creation is keyed on the subscription item, so a retry reuses the key.
- **Observability:**
  - Structured logs.
  - Vercel log drains, or Sentry, for errors.
  - An alert email to admins when a webhook or cron job fails, or when the usage sync finds no data.
- **Testing:**
  - **Port the pure-logic unit tests:** seats, `deriveSubscriptionRecord`, drift, resync planning, pending plan, price calculator, enquiry qualification, try-it limits, GoCardless guards, Marketplace removed.
  - **Add RLS tests** with the Supabase CLI against a local database.
  - **Add Playwright journeys:**
    - sign up, trial checkout, key visible
    - invite a member, who uses tools but can't see the key
    - admin resync
    - trial sign-up held for review (sandbox only), then approved by an admin, then the production key appears and the trial end has moved
    - owner switches tier during a trial, then starts paying early; the key stays the same and moves usage plan
    - paid owner upgrades (charged the previewed amount) and schedules a downgrade (blocked when the team is too big)
  - **Unit tests** for the review rules (which sign-ups are approved automatically) and the plan-change rules (which change is immediate, scheduled or blocked).
- **CI:** lint, typecheck, unit tests, database migrations against an ephemeral Supabase, build, and the sitemap URL-parity check.
- **Environments:**
  - Local (Supabase CLI and Stripe CLI)
  - Preview (per PR, staging Supabase, Stripe test)
  - Staging (`staging.mintly.uk`)
  - Production (`www.mintly.uk`)

---

## 10. Migration

### 10.1 Data

A one-off script (`scripts/migrate/`), run against staging first and then production:

1. **Organisations:** one per distinct `customerId` in `ProductSubscription` and Cognito, named from the owner's `custom:companyName` or the Stripe customer's name.
2. **Users:** create Supabase auth users for every Cognito user with the same email, `email_confirmed`, and **no password**. Profile fields are copied over and `legacy_cognito_sub` is stored.
3. **Memberships:** `isTeamAdmin=true` becomes owner; everyone else with a `customerId` becomes member. Owners are told they can promote developers.
4. **Subscriptions and keys:** copy from `ProductSubscription`, then run a full resync from Stripe for every organisation, so the new database starts with no drift. Import the manual EISCD keys from a list prepared by hand.
5. **Invitations:** copy pending rows from `team` with a fresh 14-day expiry.
6. **Usage:** backfill `usage_daily` (2 years).
7. **Admins:** set `is_mintly_admin` for the current Cognito `admin` group.
8. **SSO tenants:** register each identity provider in Supabase and add its `sso_domains` row.
9. **Offers:** the current rows don't work (requirements §5.4), so they aren't migrated. Re-create any live offers by hand.
10. **Review status:** every migrated organisation starts as `approved`. Seed `trusted_domains` from the email domains of current paying customers, after checking the list by hand.

### 10.2 Cut-over

| When | Step |
|---|---|
| **4 weeks before** | Email all users: the date, that they'll need to set a password on first sign-in (a "set your password" link is emailed on the day), and that API keys are **not** changing. |
| **4 weeks before** | Email each SSO tenant's IT contact with the new SAML settings (ACS URL and entity ID) and ask them to add these **alongside** the old ones. |
| **1 week before** | Full rehearsal on staging with a copy of production data. The Playwright journeys must pass. |
| **Day, step 1** | Freeze admin changes. Run the migration script and resync. |
| **Day, step 2** | Add the new Stripe webhook endpoint. Disable the old one. Replay any events from the gap with `stripe events resend`, which is safe because of idempotency. |
| **Day, step 3** | Switch DNS for `www.mintly.uk` to Vercel. |
| **Day, step 4** | Send the "set your password" emails (Supabase password recovery links). |
| **Day, step 5** | Smoke test: sign in, Tools check, key visible to owner and developer only, usage chart, checkout in live mode with a 100%-off promotion code, admin resync. |
| **Afterwards** | Keep the Amplify stack in read-only mode for 2 weeks for rollback, then delete the Lambdas, APIs, Cognito pool, Marketplace SQS and the unused tables. |

API customers see **no change**: the API URLs and keys stay the same, because the APIs aren't moving.

### 10.3 Retiring AWS Marketplace (Q4)

- Confirm no active Marketplace entitlements remain.
- Delist the product in the AWS Marketplace console.
- Delete `notificationHandlerService` and its SQS queue at decommission.
- Remove the Marketplace special case from Tools (`TOOL-01` becomes simply "has a live Bank Account Checker subscription").

### 10.4 Running in parallel

The old and new systems share Stripe and AWS. Reading them from both is safe. **These actions must only ever be done by one system at a time:**
- handling Stripe webhook events (Stripe sends every event to every registered endpoint)
- creating, moving, rotating or disabling API Gateway keys
- reporting metered usage to Stripe (otherwise customers are billed twice)
- creating GoCardless payments (otherwise customers are debited twice)
- sending customer emails and updating Brevo

**While building (phases 0–7): fully isolated.**
- The new app uses its **own Stripe sandbox**, not the test mode the old staging uses. Otherwise each system's webhook would react to the other's test checkouts. Prices are created there by script with the same metadata.
- Sandbox prices point at **test usage plans only** (the sandbox API's, or dedicated test plans). Keys the new app creates are tagged and named (for example `platform=v2`, `env=staging`), and the staging IAM role is limited to those usage plans.
- Scheduled jobs in staging (metering, GoCardless, reminders, retention) only ever touch the Stripe sandbox and test usage plans.

**Before cut-over: shadow mode against production, for 2–4 weeks.**
- A second **live** Stripe webhook endpoint points at the new app, with side effects switched off. The app records each event and works out what it *would* do (subscription record, key actions, emails) without doing it.
- Shadow mode is enforced by credentials, not just a flag: a **Stripe restricted key with read access only**, and an **IAM role allowing only `apigateway:GET` and `dynamodb:Query`**.
- A nightly report compares what the new app worked out with DynamoDB. Metering runs in calculate-only mode and its quantities are compared with what the old Lambda sent to Stripe.
- Admins can use the new admin area read-only against real data.

**Cut-over: one switch for all of them** (§10.2, day steps 1–2):
1. Disable the old webhook endpoint.
2. Disable the old `metering`, `goCardlessPayment` and `usageReporter` schedules and triggers.
3. Swap the new app to its write-enabled Stripe key and IAM role.
4. Turn side effects on.

**Rollback** is the same switch in reverse. Stripe is the source of truth, so the old app's **Resync from Stripe** brings DynamoDB back in line for any customer the new app changed in the meantime.

**Not proposed:** splitting customers between the two systems. Every handler would need to know which system owns each customer, and with under 100 users a single cut-over after shadow mode is simpler and safer.

**Check before shadow mode:** the old metering Lambda uses Stripe's legacy usage records (`createUsageRecord`), which newer Stripe API versions replace with Billing Meters. The new app must either report usage the same way as the old one until cut-over, or the metered prices must be moved to meters as a planned step first.

---

## 11. Delivery phases

Each phase ends with something working on staging.

| Phase | Scope | Exit criteria |
|---|---|---|
| **0. Foundations** | Repository scaffold (Next.js, TypeScript, Tailwind, shadcn/ui); Supabase projects (staging and production, London) and migrations; Vercel projects and environments; AWS OIDC roles; CI | Empty app deploys to staging; database migrations run in CI |
| **1. Auth and organisations** | Sign-up and sign-in, admin MFA, denylist hook, T&Cs with versions, password reset, profiles, organisations and memberships, RLS helpers, role matrix tests | A user can sign up and edit their profile; RLS tests pass |
| **2. Billing and provisioning** | Key rotation, returning-customer key notice, plans, checkout, Stripe webhook with idempotency, AWS adapter, key provisioning, subscription page, billing portal, Brevo, Resend emails; **trial review** (pending state, review queue, approve, ask, decline, auto-approve rules, sandbox mode); **Change plan** (`changePlan()`, preview, trial switch, start paid, upgrade, scheduled downgrade, trial reminders) | A trial on staging waits for review; once approved, a key appears in the right usage plan for the owner. An owner can move from a Starter trial to Professional paid without contacting support. |
| **3. Tools and usage** | Check proxy and batch, Tools UI, `check_log`, usage sync job and backfill, usage page | A member runs bulk checks without ever receiving the key; the charts match the old site |
| **4. Teams** | Invites with roles and expiry, join flow with consent, seats, remove and role changes, SSO sign-in and domain linking | The Playwright team journey passes; an SSO test tenant can sign in |
| **5. Admin** | Set up a customer, view as customer, business dashboard, organisations list and detail, drift and resync, subscription changes, key operations, team and admin management, SSO domains, EISCD provisioning, plans, offers, audit, feedback | Each admin action is audited and covered by a test |
| **6. Marketing site** | Design system pages, MDX content, SEO metadata, redirects, headers and CSP, free checker, enquiry, consent, analytics | Sitemap parity check passes; Lighthouse ≥ 90 on key pages |
| **7. Billing extras** | Metering cron, GoCardless, offers end to end, payment-failure notices, billing contacts, cancellation step, retention job | Metered usage appears in Stripe test mode |
| **8. Shadow mode** | Live webhook endpoint and read-only credentials; nightly comparison with DynamoDB and the old metering (§10.4) | 2 weeks with no unexplained differences |
| **9. Migration and launch** | Migration scripts, rehearsal, communications, cut-over, decommission | §10.2 completed |

Phase 6 can run alongside phases 2–5 because it doesn't depend on them.

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| SSO tenants don't update their IdP in time | Early notice; they add the new settings alongside the old; tenants that miss the date can use password sign-in temporarily |
| Users miss the "set your password" email | "Forgot password" works for every migrated email; a banner on the sign-in page explains it; support is briefed |
| A Stripe event is lost during the switch | Event idempotency plus a replay window; a full resync after cut-over |
| A key is moved to the wrong usage plan | Plan IDs come from price metadata; the Plans health page must be clean before launch; resync preview |
| More Vercel function use from the proxy and bulk checks | Batching (25 per call); monitor usage after launch |
| SEO drop from the redesign | URLs, redirects, canonicals and structured data kept; sitemap parity test; watch Search Console after launch |
| Supabase SAML limits (CLI-only set-up, plan requirements) | Few tenants; set-up is documented; WorkOS stays a fallback if tenants want self-service set-up |
| Genuine trial customers drop off while waiting for review | Sandbox mode while pending; trusted-domain auto-approval; reminders after 4 working hours; the trial clock starts on approval; track time-to-approve and the drop-off rate |
| Scammers adapt (new domains, VPNs) | Repeat-trial and IP signals in the queue; blocked domains; Suspend for abuse found later; the trial daily limit stays. No card risk is available, because trials take no card. |
| A plan change charges the customer something unexpected | Every change shows Stripe's own preview first; downgrades only at renewal; confirmation email; changes recorded in `plan_changes` |

---

## 13. Still to confirm

These are smaller choices. Defaults are proposed, so they don't block phase 0.

1. **Invite expiry:** 14 days proposed.
2. *(Decided: owners and developers can rotate the key themselves at launch, §6.13.)*
3. **Bot protection:** keep reCAPTCHA, or switch to Cloudflare Turnstile (free and more privacy-friendly).
4. **`check_log` retention:** 13 months proposed.
5. **Design direction:** Tailwind and shadcn/ui proposed. Any brand guidelines or designer input?
6. **Developer role and usage:** can developers see the per-person breakdown, or only owners? Owners only proposed.
7. **Which Supabase plan:** SAML SSO needs a paid plan. Confirm the cost.
8. **Ownership changes:** should owners be able to hand ownership to another member themselves, or only through support? Only through support is proposed for launch.

### Decided since draft 3

- **Card risk:** not used in approval. Trials take no card, so every new trial organisation is reviewed unless an auto-approve rule matches (§6.11).
- **Sandbox key:** Mintly will provide one for sandbox mode while pending (§6.11).
- **Review service level:** within one working day, with an admin reminder after 4 working hours.
- **Upgrade charges:** prorated and charged straight away (§6.12).
- **Extra seats:** never bought by customers; admins set them (§6.12).
