# Setting up Stripe, AWS and email for billing (phase 2)

Phase 2a adds checkout, the Stripe webhook and API key provisioning (plan §6.3, §6.5, §7). This page covers what each environment needs. Until it's done, the app still runs: without Stripe the plan page says checkout isn't available, without AWS an in-memory fake stands in for API Gateway, and without Resend or Brevo those calls are logged and skipped.

## 1. A Stripe sandbox of its own

The new app uses **its own Stripe sandbox**, not the test mode the old site's staging uses. Otherwise each system's webhook would react to the other's test checkouts (plan §10.4). Live keys are refused everywhere except production (`NFR-03`).

| Variable | Where to find it |
|---|---|
| `STRIPE_SECRET_KEY` | Sandbox → Developers → API keys → Secret key |
| `STRIPE_WEBHOOK_SECRET` | The webhook endpoint's signing secret (step 3), or `stripe listen`'s locally |

## 2. Prices and their metadata

The app finds prices by metadata, never by hard-coded ID (`ADM-10`):

| Key | Example | Meaning |
|---|---|---|
| `product` | `bank_checker` or `eiscd` | Which product the price is for. EISCD prices are left to admins (plan §6.7). |
| `tier` | `starter`, `standardPlus`, `professional` | The self-serve plan. Custom and legacy prices have no tier. |
| `interval` | `monthly` or `annual` | The billing period checkout sells it on |
| `usagePlanId` | `abc123` | The API Gateway usage plan for paid subscriptions |
| `trialUsagePlanId` | `def456` | The usage plan while trialing |
| `maxTeamSize` | `5` | Seats the price includes, owner included (`PROV-09`) |

A price without the usage plan the subscription needs makes the webhook return 500, so Stripe retries once the metadata is fixed (`PROV-10`).

Create the self-serve prices with the seed script, pointing at **test usage plans only**:

```bash
STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-seed-prices.mjs --plan starter=<paid>,<trial> --plan standardPlus=<paid>,<trial> --plan professional=<paid>,<trial>
```

It is safe to run again: existing prices are found by lookup key and only their metadata is updated. The seeded prices are flat. Metered overage (`BILL-05`) needs prices on a Stripe Billing Meter, which arrive with the metering job in phase 7.

## 3. The webhook

Add an endpoint at `https://<host>/api/webhooks/stripe` (Developers → Webhooks) for these events:

- `checkout.session.completed`
- `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
- `invoice.paid`, `invoice.payment_failed`

Copy its signing secret into `STRIPE_WEBHOOK_SECRET`. Every event is recorded in `stripe_events`; a failed one keeps its `error` there and is retried by Stripe.

Locally:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

## 4. The billing portal

Settings → Billing → Customer portal: allow updating payment methods and billing details, viewing invoices, and cancelling at the end of the period. Leave **switching plans off**: plan changes go through the app (plan §6.12, phase 2c).

Under Settings → Public details, set the terms of service URL, which Checkout asks customers to accept.

## 5. AWS

Set `AWS_ROLE_ARN` to the environment's role (`mintly-web-staging` or `mintly-web-production`), assumed through Vercel OIDC (plan §7). The role needs `apigateway:GET`, `POST`, `PATCH` and `DELETE` on `/apikeys*` and `/usageplans*` only. On staging, limit it to the test usage plans.

Without `AWS_ROLE_ARN` the app uses an in-memory fake that logs each key action (`[fake-aws] createKey …`) and refuses to run on production. Its keys are lost when the server restarts.

Keys the app creates are named `v2-<subscription item ID>` and tagged `platform=v2` and `env=<environment>`.

## 6. Email and Brevo

| Variable | Notes |
|---|---|
| `RESEND_API_KEY`, `EMAIL_FROM` | Resend, with a verified sending domain. Without a key, emails are logged. |
| `ADMIN_NOTIFY_EMAIL` | Where new-customer and new-user notices go. Defaults to `info@mintly.uk`. |
| `BREVO_API_KEY`, `BREVO_LIST_ID` | The marketing list. Leave unset on previews so they never touch it. |

## 7. Trial review and the reminders job (phase 2b)

New trial organisations wait for an admin's approval at `/admin/reviews` (plan §6.11). They get no API key until then, and approval restarts the 14-day trial.

| Variable | Notes |
|---|---|
| `CRON_SECRET` | Vercel sends it to `/api/cron/reminders`, which `vercel.json` schedules hourly. It reminds admins about trials waiting more than 4 working hours and declines trials pending for 7 days. |
| `IP_HASH_SECRET` | Hashes sign-up IP addresses so repeat trials can be matched without storing the address. Required on production. |

Trusted domains (approved automatically) and blocked domains (sign-up refused) are managed at `/admin/reviews/domains`. Before launch, seed the trusted list from current paying customers' domains, after checking it by hand (plan §10.1 step 10).
