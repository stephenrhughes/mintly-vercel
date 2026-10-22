# Enquiry qualification flow — question spec

Status: **agreed question set, not yet built.** This document fixes the questions,
their wording, the branching and the routing rules. The component build follows
from it.

## Why this exists

`src/components/Enquiry.js` is currently name / email / phone / free-text message.
It gives us no idea whether the person wants the checking API or an EISCD licence,
what volume they're at, or whether we can help them at all — so every enquiry costs
a discovery email round-trip, and people who actually want Confirmation of Payee get
as far as a call before we tell them we don't do it.

The qualifier has three jobs, in this order:

1. **Route to the right product** — Bank Account Checker API vs EISCD data file licence.
2. **Screen out the wrong fit early and honestly** — chiefly Confirmation of Payee.
3. **Land them in the right plan band** so the ending can name a plan and a price
   instead of "we'll be in touch."

A fourth job it does almost for free: showing someone what failed payments are
costing them, using their own numbers.

## Agreed design decisions

| Decision | Choice |
| --- | --- |
| Ending | **Route by answer** — self-serve trial, book a call, or send enquiry, depending on the answers |
| Contact capture | **At the end only** — questions first, contact details to receive the result |
| Cost of failed payments | **Ask and show the calculated figure on screen** |
| Confirmation of Payee | **Explain the difference and let them continue** if validation is still useful |

## Flow map

```
Q1 product ─┬─ API ──────► Q2 CoP screen ─► Q3 volume ─► Q4 timing ─► Q5 integration
            │                                  │
            │                                  └─► Q6a/Q6b failed payments ─► Q7 constraints
            │                                                                      │
            ├─ EISCD ────► E1 use ─► E2 format ─► E3 frequency ─► E4 sites ────────┤
            │                                                                      │
            └─ Not sure ─► Q2 CoP screen ─► Q3 volume ─► Q4 timing ─► Q5 ──────────┤
                                                                                   ▼
                                                                        Q8 sector ─► Q9 contact
                                                                                   ▼
                                                                              Outcome screen
```

Most people see 6–7 screens. The EISCD branch is 5 before contact. One question per
screen, back button always available, answers preserved when going back.

## Seeding from page context

`Enquiry` is embedded on `/`, `/pricing`, `/eiscd`, `/faq`, `/Platform`,
`/integration-guides` and `/dashboard`. Pass the host page in so Q1 can be
pre-selected (not skipped — they can change it):

- `/eiscd` → pre-select **EISCD data file**
- `/pricing`, `/integration-guides`, `/Platform` → pre-select **checking API**
- everywhere else → no pre-selection

---

## The questions

### Q1 — Product routing

> **What are you looking to do?**

- `api` — Check that bank details are valid before I pay someone or collect a payment
- `eiscd` — Hold the full UK sort code directory inside my own systems
- `unsure` — Both, or I'm not sure yet

Required. `eiscd` → EISCD branch. `api` and `unsure` → main branch.

---

### Q2 — Confirmation of Payee screen

> **What do you need to confirm?**

- `details` — That the sort code and account number are real and correctly formed
- `name` — That the account holder's **name** matches the person I'm paying
- `both` — Both of those

Required. Answering `name` or `both` shows this, inline, before continuing:

> **Name matching is a separate service called Confirmation of Payee, and we don't
> provide it.** What we do is the layer underneath: we confirm the sort code and
> account number are real, correctly formed and reachable by BACS, Faster Payments,
> CHAPS or ICS. Most teams run that check first — it's fast and costs pence — and
> then send only what's left to a CoP provider. If that's useful to you, keep going
> and we'll show you what it costs. If it isn't, no hard feelings.

Buttons: **Keep going** / **That's not what I need**. The second ends the flow on a
short, friendly screen with a link to the FAQ entry on CoP. Record the exit — how
many people leave here is worth knowing.

*Rationale:* this is the single most common mismatch in inbound enquiries, and
`src/pages/faq.js` and the validation articles already draw exactly this distinction.
Saying it at step 2 costs one screen and saves a call.

---

### Q3 — Volume

> **Roughly how many checks would you need each month?**

- `lt250` — Fewer than 250
- `250_10k` — 250 to 10,000
- `10k_25k` — 10,000 to 25,000
- `25k_50k` — 25,000 to 50,000
- `50k_plus` — More than 50,000
- `unknown` — I don't know yet

Required. Bands are drawn straight from the plan allowances in
`src/components/Products.js`, so the answer resolves to a named plan.

---

### Q4 — When the checks happen

> **When would the checks happen?**

- `realtime` — One at a time, live, as someone enters their details
- `batch` — In batches — a payroll run, a supplier file, monthly billing
- `adhoc` — Occasional one-off lookups
- `database` — Re-validating a database of accounts we already hold

Required. This is the real API-vs-EISCD discriminator: `database` or `batch` at high
volume is often a licence conversation rather than a per-check one. If Q1 was
`unsure`, this answer decides which product the outcome screen leads with.

---

### Q5 — Integration

> **How would you want to connect?**

- `api` — Our developers would integrate the REST API
- `nocode` — No code — Zapier, or upload a file to the secure portal
- `file` — We want the raw data file to load into our own systems
- `undecided` — Haven't decided yet

Required. `file` re-routes to the EISCD branch (picking up at E2) even if they
started down the API path.

---

### Q6a — Failed payments, volume

> **Roughly how many payments a month fail because the bank details were wrong?**

- `none` — None that we know of
- `lt10` — Fewer than 10
- `10_100` — 10 to 100
- `100_1000` — 100 to 1,000
- `1000_plus` — More than 1,000
- `unknown` — No idea

Required.

### Q6b — Failed payments, cost

Skipped when Q6a is `none` or `unknown`.

> **And roughly what does one failure cost to put right — bank charges plus the time
> someone spends chasing it?**

- `lt5` — Under £5
- `5_20` — £5 to £20
- `20_50` — £20 to £50
- `50_plus` — More than £50
- `unknown` — Not sure

*Rationale:* asking for a single pound figure gets blanks. Two bands gets an answer
from almost everyone, and the product of the two is the number that makes the case.

#### The figure we show

Midpoints, multiplied, rounded down to two significant figures, and always labelled
as their estimate rather than our claim:

| Q6a | failures | Q6b | £ each |
| --- | --- | --- | --- |
| `lt10` | 5 | `lt5` | 3 |
| `10_100` | 50 | `5_20` | 12 |
| `100_1000` | 400 | `20_50` | 32 |
| `1000_plus` | 1,500 | `50_plus` | 65 |

Shown on the outcome screen, next to the recommended plan price:

> Based on what you've told us, wrong bank details are costing you in the region of
> **£1,800 a month**. Checking 10,000 accounts with Mintly costs £96.

Rules:
- Only shown when both Q6a and Q6b have real answers. No estimate, no figure.
- `none` gets a different line: *"Sounds like you've got this under control already —
  most of our customers use us to keep it that way as they grow."*
- Never shown on the EISCD branch (licence pricing isn't per-check, the comparison
  doesn't hold).

---

### Q7 — Constraints

> **Anything we should know before we reply?** (choose any that apply)

- `security` — We'd need a security review or a DPA
- `onprem` — The data needs to stay inside our own infrastructure
- `procurement` — We buy through procurement — PO and invoice, not a card
- `throughput` — We need more than 1,000 checks a minute
- `teams` — Several people or teams would use it
- `none` — None of these

Optional, multi-select. `none` is exclusive. `onprem` steers the outcome toward
EISCD; `security`, `procurement` and `throughput` each force the "book a call"
ending regardless of volume, because none of them survive a self-serve signup.

---

### Q8 — Sector

> **What kind of business are you?**

Payroll bureau · Lender or broker · Insurer · Accountancy practice · Marketplace or
gig platform · Utility or telco · Charity · Software vendor building this into a
product · Local or central government · Something else

Optional, single select, with a free-text "something else". Cheap to ask and it
decides which case study and which reply template we use.

---

### Q9 — Contact

> **Where should we send this?**

- Name (required)
- Work email (required)
- Company (required)
- Phone (optional)
- Anything else you'd like to tell us (optional, free text — the current message box,
  kept for the things a form can't anticipate)

reCAPTCHA stays where it is, invisible, executed on submit.

---

## EISCD branch

### E1 — Use

> **What will you use the directory for?**

- Validating accounts inside our own systems
- Routing and clearing — working out which scheme a sort code supports
- Enriching branch or address data on records we hold
- Reference data for reporting or reconciliation
- Something else

### E2 — Format

> **Which format suits you?** — CSV · TXT · XML · XLSX · Not sure yet

### E3 — Update frequency

> **How often do you need it?**

- Weekly, full file
- Weekly, changes only
- Monthly or quarterly
- A single one-off extract

*Rationale:* the pricing card already says a single extract or less frequent
downloads is a "contact us" price, so this answer changes what we quote.

### E4 — Sites

> **How many sites or data centres would use the data?** — One · Two to five ·
> More than five · Not sure

The standard licence is single-site; anything above one is a different quote.

Then straight to Q7 (constraints), Q8 (sector), Q9 (contact).

---

## Routing rules

Evaluated top to bottom; the first match wins.

| # | Condition | Outcome |
| --- | --- | --- |
| 1 | Exited at the CoP screen | Friendly close, link to the CoP FAQ. No enquiry sent unless they ask. |
| 2 | EISCD branch | **Book an EISCD call** — `BookDemoButton eiscdMeeting`, Cal link `interest-in-eiscd-licence`. Enquiry also sent. |
| 3 | Q7 includes `security`, `procurement` or `throughput` | **Book a call** — `introduction-to-mintly-bank-account-checker-apis`. Enquiry sent with the flags at the top. |
| 4 | Volume `50k_plus`, or `25k_50k` | **Book a call** — matches the existing "Need 50,000 checks per month or more?" prompt on the pricing page. |
| 5 | Volume `unknown` | **Send the enquiry**, and offer the call as a secondary action. |
| 6 | Volume `10k_25k` | **Professional Plan** — £157/mo, 25,000 checks, 0.8p thereafter, 1,000/min, 15 users. Start the 14-day trial. |
| 7 | Volume `250_10k` | **Standard Plus** — £96/mo, 10,000 checks, 1.2p, 100/min, 5 users. Start the trial. |
| 8 | Volume `lt250` | **Starter** — £37/mo, 250 checks, 5p, 10/min, single user. Start the trial. |

Trial endings still send the enquiry, so a lead is never lost to a signup someone
didn't finish. Every ending shows the ROI figure where we have one.

Plan figures above are duplicated from `src/components/Products.js` — the build
should read them from a shared source rather than hard-coding them a second time.

---

## What gets sent to us

The Lambda at `amplify/backend/function/enquiry/src/index.js` currently takes
`{ fromAddress, name, message, token }` and emails `message` as an HTML body. The
qualifier can work within that by composing a formatted `message`, but the answers
are worth having as structured fields — for the reply template, and for knowing
which questions people abandon on.

Proposed payload, backwards compatible:

```json
{
  "fromAddress": "...", "name": "...", "token": "...",
  "message": "<formatted transcript, so existing email handling still works>",
  "qualification": {
    "product": "api", "confirms": "details", "volume": "250_10k",
    "cadence": "realtime", "integration": "api",
    "failures": "10_100", "failureCost": "5_20", "estimatedMonthlyCost": 600,
    "constraints": ["teams"], "sector": "payroll",
    "company": "...", "phone": "...", "notes": "...",
    "outcome": "trial_standard_plus", "sourcePage": "/pricing"
  }
}
```

The email subject should carry the qualification, since that's what decides whether
we reply or ring: `New enquiry — Standard Plus, 250–10k checks/mo, payroll bureau`.

---

## Still open

- Whether an abandoned flow should reach us at all. The agreed design captures
  contact details last, so a drop-off at Q5 is anonymous by construction. Revisit
  only if the drop-off rate turns out to be high.
- Whether the ROI figure should also appear on the pricing page as a standalone
  calculator. Same two questions, no enquiry attached.
- Analytics: the existing `event("enquiry_sent", ...)` should be joined by a
  per-step event so we can see where people stop.
