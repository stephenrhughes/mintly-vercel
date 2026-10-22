# Mintly web app: requirements for a rewrite

**Status:** Draft 3. It records what the app does today, taken from the codebase. The open questions are now answered (§14), new requirements are in §15, and the plan for the new application is in [`rewrite-plan.md`](./rewrite-plan.md).
**Purpose:** a baseline for rebuilding the portal on Vercel with Supabase, so that nothing users rely on is lost in the move.
**Scope:** the customer portal, the admin area, the background jobs and integrations behind them, and (briefly) the public marketing site that is deployed with them.

Each requirement has an ID (for example `OWN-03`) so later documents and tickets can refer to it. "Source" points to where the current behaviour lives. Where today's behaviour looks like a bug or a gap, the requirement says so, so the rewrite can fix it rather than copy it.

---

## 1. Summary

Mintly sells two API products:
- the **Bank Account Checker** (sort code, account number, IBAN and SWIFT/BIC validation)
- the **EISCD data file and API** (the UK sort code directory)

This repository is the website and portal around those APIs. It does **not** contain the APIs themselves. Those run on AWS API Gateway at `api.mintly.uk` and `sandbox.mintly.uk`, and API Gateway enforces the quotas and throttling.

The portal's jobs are:
1. **Sell and bill:** plan selection, Stripe Checkout with a 14-day trial, the Stripe billing portal, and custom offers.
2. **Provision access:** create an API Gateway key per customer, attach it to the usage plan for their price, and move or disable it as the subscription changes.
3. **Let customers use the product without code:** web tools for single and bulk checks.
4. **Let developers integrate:** the API key, docs, OpenAPI specs, Postman collection and integration guides.
5. **Let teams share one subscription:** invites, seats, and SSO for enterprise tenants.
6. **Let Mintly admins run the business:** customer view, Stripe drift detection and resync, plan catalogue health, and offers.

There are under 100 registered users in Cognito.

### 1.1 Current stack (for reference)

| Concern | Today |
|---|---|
| Frontend | Next.js 15 (pages router), React 18, reactstrap/Bootstrap 4 (Argon theme), Amplify UI `Authenticator` |
| Hosting | AWS Amplify Hosting (custom headers in `customHttp.yml`) |
| Auth | Amazon Cognito user pool, plus SAML identity providers per enterprise tenant |
| API layer | About 12 API Gateway REST APIs (IAM auth) in front of about 22 Lambda functions (`amplify/backend/function/`) |
| Data | DynamoDB tables (see §8), plus the external `ApiDailyUsageStats` table written by the API platform |
| Billing | Stripe (Checkout, Billing Portal, webhooks, metered usage), GoCardless for direct debit collection |
| Email | Amazon SES (transactional), Brevo (marketing list) |
| Other | Google reCAPTCHA, Google Analytics, Meta Pixel, Tawk.to chat, Cal.com booking, AWS Marketplace (SaaS listing) |

---

## 2. Users and roles

The brief describes three kinds of user. In the code they map onto these roles:

| Role | How it is identified today | Who they are |
|---|---|---|
| **Visitor** | Not signed in | Prospects using the public site and the free checker |
| **Registered user, no subscription** | Signed in; no `custom:customerId` | Someone who signed up but hasn't started a trial or bought a plan |
| **Account owner** (the "team admin") | `custom:isTeamAdmin = "true"`, set when their Stripe checkout completes | The person who bought the subscription. They manage billing and the team. |
| **Team member** | `custom:customerId` and `custom:apiKeyId` copied from the owner; `custom:isTeamAdmin = "false"` | Colleagues using the web tools under the organisation's subscription |
| **Mintly admin** | Member of the Cognito group `admin` (checked on the server) | Mintly staff |

**Portal users and API-only users are not separate roles in the code.** Every signed-in user linked to a subscription sees both the web tools and the API key. The difference is only in what they use. A team member who only uses the Tools page can still see and copy the organisation's API key (§4.2). The rewrite should decide whether to keep that or add a real distinction (see open question Q1).

Everyone in a team shares **one API key**, the owner's. Usage, quotas and billing are therefore per organisation, not per person.

---

## 3. Requirements common to every signed-in user

### 3.1 Sign-up and sign-in

| ID | Requirement | Source |
|---|---|---|
| AUTH-01 | Sign up with email (labelled "Work email") and password. The email is the username. | `src/utils/authConfig.js`, `amplify/backend/backend-config.json` |
| AUTH-02 | Password policy: at least 8 characters, with upper case, lower case, number and symbol. Errors use friendly wording ("Needs a symbol (e.g. ! @ # $)"). | `authConfig.js` (I18n overrides) |
| AUTH-03 | The email is verified with a code before the account can be used. The confirm screen tells people to check spam and gives the support address. | `authConfig.js` `ConfirmSignUp.Footer` |
| AUTH-04 | **Work emails only.** Sign-up is refused for about 4,800 free and disposable email domains, with "Invalid email domain (x), please use a work email address". The domain is taken after the *last* `@`. There is a hard-coded bypass for one test address. | `mintlywebPreSignup/src/email-filter-denylist.js`, `emailBannedDomains.js` |
| AUTH-05 | Sign-up requires ticking "I have read and accept the terms and conditions and privacy policy", with links to both. The value is stored (`custom:acknowledgement`). | `authConfig.js` |
| AUTH-06 | Sign-up has an opt-out checkbox for product emails. It is stored as `custom:marketingOptOut` (`yes`/`no`) and decides whether the user goes on the Brevo list when they subscribe. | `authConfig.js`, `register/src/app.js` |
| AUTH-07 | When a user confirms their account, `info@mintly.uk` is emailed ("user has been confirmed: <email>"). | `mintlywebPostConfirmation/src/custom.js` |
| AUTH-08 | The sign-in form opens on "Sign up" for first-time visitors and on "Sign in" once this browser has signed in before (localStorage `REGISTERED`). | `src/hooks/useLocalStorage.js`, the pages that use `Authenticator` |
| AUTH-09 | The authenticated pages (`/dashboard`, `/tools`, `/monitor`, `/join`, `/admin`, `/success`) show the sign-in or sign-up form in place when the visitor isn't signed in, then show the page after sign-in, with no separate login page. | the pages listed |
| AUTH-10 | An expired session signs the user out and shows the sign-in form again. | `dashboard.js`, `tools.js` |
| AUTH-11 | Sign-in and auth events are sent to Google Analytics. | `dashboard.js`, `tools.js` (`Hub.listen`) |
| AUTH-12 | Password reset by email (Amplify's built-in "Forgot password" flow). | Amplify `Authenticator` |
| AUTH-13 | MFA is **off**. | `backend-config.json` |

### 3.2 Enterprise single sign-on (SAML)

| ID | Requirement | Source |
|---|---|---|
| SSO-01 | The sign-in form has a "Sign In with SSO" section: the user enters a work email and the app looks up an identity provider for the email's domain. | `authConfig.js` `SignIn.Footer` |
| SSO-02 | The lookup is protected by invisible reCAPTCHA, an origin allow-list (www and staging, plus localhost on staging) and an API key. | `identityProvider/src/index.js` |
| SSO-03 | If the domain has an identity provider, the user is redirected to the Cognito hosted UI for that SAML provider. The redirect URL is wrapped in a short-lived (60s) signed token. If the domain has none, the user drops back to the normal password sign-in with the email pre-filled. | `identityProvider/src/index.js` |
| SSO-04 | After the IdP, `/auth-callback` swaps the code for tokens on the server and returns the user to the page they started on. | `src/pages/auth-callback.js`, `exchangeForToken/src/index.js` |
| SSO-05 | **Automatic team membership.** On their first SSO sign-in, a user whose email domain is mapped to a tenant is linked to that tenant's customer: their `customerId` and `apiKeyId` are set, they are made a non-admin member, and their email is marked verified. This only happens if the tenant has a live subscription. Seat limits are **not** enforced for SSO users; the admin view flags teams over their limit instead. | `mintlywebPostConfirmation/src/ssoSetup.js` |
| SSO-06 | SSO users can't change their password in the portal (the section is hidden). | `src/components/Account.js` |
| SSO-07 | Setting up a tenant is manual today: the customer sends SAML metadata, a developer adds a `UserPoolIdentityProvider` to `amplify/backend/auth/mintlyweb/override.ts` and deploys, then adds a row by hand to the `TenentSSOProviders` table (domain → IdP name and customer ID). | `identityProvider/README.md` |

### 3.3 Profile and account

| ID | Requirement | Source |
|---|---|---|
| ACC-01 | View email (read-only), first name, last name, company name and phone number. | `src/components/Account.js` |
| ACC-02 | Edit first name, last name (both required), company name and phone (international input, GB default). | `Account.js`, `dashboard.js` `handleProfileChange` |
| ACC-03 | Change password (non-SSO users only). | `Account.js` |
| ACC-04 | Delete own account, after a confirmation step. Not allowed while the user has an active subscription. | `Account.js` |
| ACC-05 | Users without a subscription see a "Your account is not linked to an active subscription" prompt that takes them to the plans. | `Account.js` |
| ACC-06 | Users may only write their own profile fields. They can't set `customerId`, `apiKeyId`, `isTeamAdmin` or anything else that grants access. Today this is enforced by restricting the Cognito app client's write attributes. | `amplify/backend/auth/mintlyweb/override.ts` |

> **Gap (ACC-04):** deleting an account only deletes the Cognito user. Team rows, Stripe customer data and the Brevo contact are left behind. The rewrite should define what deletion removes (GDPR erasure), and what happens when a team owner deletes their account.

### 3.4 Navigation when signed in

| ID | Requirement | Source |
|---|---|---|
| NAV-01 | The signed-in menu shows the user's email and links to: Tools, API Docs, Integration Guides, Release Notes, Monitor (usage), Settings (dashboard), and Sign Out. | `src/components/Navbars/DemoNavbar.js` |

---

## 4. Portal users: checking bank accounts and sort codes

These are the people who use Mintly through the browser: account owners and team members.

### 4.1 Web tools (`/tools`)

| ID | Requirement | Source |
|---|---|---|
| TOOL-01 | Only signed-in users linked to a Stripe subscription (`customerId` starting `cus_`) can use the tools. A user with no API key is sent to `/dashboard`. AWS Marketplace customers have no Tools access. | `src/pages/tools.js`, `src/components/Tools.js` `bankCheckerProduct` |
| TOOL-02 | The tools call the production API (`https://api.mintly.uk/bankAccount/v1`) **from the browser with the organisation's API key**, so every check counts against the customer's quota and shows in their usage. | `tools.js`, `Tools.js` |
| TOOL-03 | **Single check, sort code and account:** sort code (6 digits, with or without hyphens) and an optional account number (6–10 digits), validated as you type. With no account number it returns the sort code details only. | `Tools.js` `validate` |
| TOOL-04 | **Single check, IBAN:** spaces are stripped and the format is checked as you type. | `Tools.js` `validateIban` |
| TOOL-05 | **Single check, SWIFT/BIC:** 8 or 11 characters; 8-character codes are padded with `X` to 11. | `Tools.js` `validateSwift` |
| TOOL-06 | Results show the validity and the bank and branch details the API returns, with clear valid and invalid icons, and scroll into view. | `src/components/AccountResult.js` |
| TOOL-07 | Each result shows the API path that was called, so users can see how to do the same thing with the API. | `Tools.js` (`endpoint` state) |
| TOOL-08 | **Bulk check:** paste lines, or drag and drop or upload a `.txt`/`.csv` file of up to 1 MB. Four input types: `sortcode,account` (the default), sort code only, IBAN only, BIC only. Malformed lines are reported per line, not sent. | `Tools.js` `validateMultiple` |
| TOOL-09 | Bulk checks are paced on the client so they don't trip API throttling: 500 ms between requests on Starter and Trial plans, 20 ms otherwise. A progress bar shows how far through it is. | `Tools.js` `delayValue` |
| TOOL-10 | Bulk results show each line's status: valid, invalid, or "Too many requests. Daily trial limit or request rate limit reached". | `Tools.js` |
| TOOL-11 | Bulk results can be **downloaded as CSV** (status, data, input) on paid plans only. Trial users see "Upgrade to paid plan to download results". | `Tools.js` |
| TOOL-12 | When the quota or rate limit is hit, the user sees an explanation: trial users have reached the daily evaluation limit and should contact support to upgrade; paid users should try again later. | `Tools.js` `trialLimitMessage` |
| TOOL-13 | Built-in help: example code snippets for calling the API (JavaScript, Python and so on) and an FAQ accordion. | `Tools.js` |

> **Note for the rewrite:** because the browser calls the API with the real key, the key is exposed to every team member's browser. A server-side proxy (a Vercel route) would keep the key on the server and let the portal record per-user usage. This is a design choice, not a current requirement (see Q2).

### 4.2 Subscription view (dashboard "Subscriptions" tab)

| ID | Requirement | Source |
|---|---|---|
| SUB-01 | Show each subscription linked to the user's organisation: the plan name (the usage plan's description) and a status badge (`active` or `inactive`). | `src/pages/dashboard.js`, `src/components/Subscription.js`, `customer/src/subscriptionProducts.js` |
| SUB-02 | A subscription is **active** only if the record isn't expired **and** the API key is enabled. Otherwise it is inactive and the key value is never returned. | `subscriptionProducts.js` `buildProduct` |
| SUB-03 | Show the API key, with a copy button and a warning to keep it secret, store it in a secrets manager, and contact support to change it. | `Subscription.js` |
| SUB-04 | Download the Postman collection; links to the API docs and OpenAPI specs. | `Subscription.js`, `public/assets/docs/Mintly-API.postman_collection.json` |
| SUB-05 | The server returns subscriptions only for the caller's own organisation, whatever IDs the request contains. | `customer/src/index.js` |
| SUB-06 | Expired subscriptions are still returned (as inactive), so the app can tell a returning customer from a new one. Returning customers see "Choose this plan" rather than "Try for free". | `subscriptionProducts.js`, `dashboard.js` `hasHadPreviousSubscription` |

### 4.3 Usage monitoring (`/monitor`)

| ID | Requirement | Source |
|---|---|---|
| MON-01 | Bar chart of daily API usage for the organisation's key, split into **Valid** (success) and **Invalid** (not found). | `src/pages/monitor.js`, `src/components/Monitoring.js` |
| MON-02 | Date ranges: 7 days, 1, 3 and 6 months, 1 and 2 years. Longer ranges are grouped by month. | `src/components/DateRangeButtons.js`, `monitoringLogic.js` |
| MON-03 | Period totals: success count and %, not-found count and %, and an "estimated saving" of £50 per invalid account caught. | `monitoringLogic.js` (`COST_PER_FAILED_ACCOUNT_GBP`) |
| MON-04 | Projected daily usage for the period. | `monitoringLogic.js` `predictedDailyUsage` |
| MON-05 | Data comes from the `ApiDailyUsageStats` table (per key, per day), which the API platform writes. Missing days are filled with zeros. | `usage/src/app.js`, `usage/src/helpers.js` |
| MON-06 | A user may only read usage for their own organisation's key. Admins may read any key's usage. | `usage/src/authorization.js` |
| MON-07 | "No usage data to display yet" when there is none. | `Monitoring.js` |

### 4.4 Joining a team (`/join?invite=…`)

| ID | Requirement | Source |
|---|---|---|
| JOIN-01 | An invite link takes the invitee to sign up or sign in, then links them to the team automatically. | `src/pages/join.js`, `joinTeam/src/index.js` |
| JOIN-02 | The signed-in email must match the invited email, otherwise the join fails. | `joinTeam` (`emailsMatch`) |
| JOIN-03 | The join fails if the organisation's subscription has expired. | `joinTeam` |
| JOIN-04 | The join is refused with "Your team is full" if accepted members already fill the seat limit. A pending invite already holds its seat, so this only happens if the limit has come down since the invite was sent. | `joinTeam`, `amplify/shared/seats.cjs` |
| JOIN-05 | On success the user gets the team's `customerId` and `apiKeyId` as a non-admin member, the invite is marked accepted, and they see "Welcome to Mintly!" with a link to Tools. Opening the link again says "You've already joined your team". | `joinTeam`, `join.js` |
| JOIN-06 | Failures explain the likely causes: the invite expired, the organisation is no longer subscribed, or a different email address was used. | `join.js` |

---

## 5. Account owners: buying and managing the subscription

The account owner is a portal user (§4) who can also do the following.

### 5.1 Choosing a plan and starting a trial

| ID | Requirement | Source |
|---|---|---|
| BUY-01 | A signed-in user with no active subscription sees the plan grid (Starter, Standard Plus, Professional; monthly or annual) and a contact or enquiry route for Enterprise. | `src/components/SubscribeSection.js`, `Products.js`, `src/utils/plans.js` |
| BUY-02 | **Plan intent survives sign-up.** A visitor who picks a plan on the public pricing page (`/dashboard?plan=<slug>`) is taken through sign-up, and then sees a "confirm this plan" panel instead of the full grid. The choice is stored in localStorage for 24 hours, by plan *slug* (never a Stripe price ID, so it can't be tampered with). The sign-up form shows a "you're starting a trial of X" banner. | `src/utils/pendingPlan.js`, `usePendingPlan.js`, `ConfirmPlan.js`, `TrialIntentBanner.js` |
| BUY-03 | Selecting a plan creates a **Stripe Checkout** session and redirects to it. New customers get a **14-day free trial with no card required**; the trial is cancelled if no payment method has been added by the end. VAT is calculated automatically and promotion codes are accepted. | `register/src/app.js` `POST /subscribe`, `stripeHelpers.js` |
| BUY-04 | Returning Stripe customers (matched by email) get a checkout without a trial. | `stripeHelpers.js` `createCheckoutSessionForExistingCustomer` |
| BUY-05 | **No accidental double subscriptions.** If the customer already has a live (trialing, active or past-due) subscription, checkout is refused (409) with its status, price and trial or period end, and the UI explains this. Only a deliberate upgrade (accepting a custom offer) may replace an existing subscription. | `register/src/app.js`, `src/utils/checkout.js` `ExistingSubscriptionError` |
| BUY-06 | Checkout returns to `/success?sessionId=…`, which records the conversion (a gtag conversion event and a GA `successful_subscription` event) and sends the user on to the dashboard. | `src/pages/success.js` |
| BUY-07 | Until the dashboard has a subscription, it also shows the qualification enquiry form (§7.3). | `SubscribeSection.js` |

Current self-serve plans (the display figures live in `src/utils/plans.js`, the Stripe price IDs in `src/utils/priceCatalogue.js`):

| Plan | Monthly | Annual | Included checks/month | Overage | Seats | Throttle (as listed in `plans.js`) |
|---|---|---|---|---|---|---|
| Starter | £37 | £360 | 250 | 5p | 1 | 10 |
| Standard Plus | £96 | £960 | 10,000 | 1.2p | 5 | 100 |
| Professional | £157 | £2,120 | 25,000 | 0.8p | 15 | 1,000 |

Extra seats cost £2.50 each. There are also per-customer **custom prices** and **legacy prices** that are no longer sold but still held by some customers. Above 50,000 checks a month, the pricing page asks for a call instead of selling a plan.

### 5.2 What happens after checkout (provisioning)

These are system requirements, but they are what the owner experiences as "my key works".

| ID | Requirement | Source |
|---|---|---|
| PROV-01 | When checkout completes: cancel any other subscriptions the customer has; create an API Gateway key (or reuse one if Stripe re-delivers the event); attach it to the usage plan named in the price's metadata (`trialUsagePlanId` while trialing, `usagePlanId` once paid); store the subscription record; make the buyer the account owner (`customerId`, `apiKeyId`, `isTeamAdmin=true`). | `register/src/app.js`, `mintlyHelpers.js` |
| PROV-02 | Email `info@mintly.uk` about the new customer. Add the customer to the Brevo marketing list unless they opted out. | `register/src/app.js` |
| PROV-03 | If the checkout came from a custom offer, mark the offer accepted. | `mintlyHelpers.js` `updateCustomOffer` |
| PROV-04 | When the trial converts to paid: move the key to the paid usage plan and update the Brevo contact. | `register/src/app.js` |
| PROV-05 | When the price changes (including in the Stripe dashboard): record the new price, subscription and item IDs, and move the key to the new price's usage plan. | `register/src/app.js`, `amplify/shared/subscriptionRecord.cjs` |
| PROV-06 | When the customer asks to cancel: record the cancellation date and remove them from the Brevo list. If they change their mind, clear it. | `register/src/app.js` |
| PROV-07 | When the subscription is cancelled or unpaid: disable the key, remove it from its usage plan and mark the record expired. **Unless** it was cancelled with the comment "Automatically cancelled by upgrading", which means it was replaced and must be left alone. | `register/src/app.js` |
| PROV-08 | When an invoice is paid: extend the expiry date. | `register/src/app.js` |
| PROV-09 | Record the seat limit from price metadata (`maxTeamSize`) and extra seats from subscription metadata (`extraUsers`). | `subscriptionRecord.cjs`, `seats.cjs` |
| PROV-10 | Webhooks are verified with the Stripe signing secret. A price without usage-plan metadata returns 500 so that Stripe retries once the metadata is fixed. EISCD prices are ignored. | `register/src/app.js` |

### 5.3 Managing billing

| ID | Requirement | Source |
|---|---|---|
| BILL-01 | The account owner (only) can open the **Stripe Billing Portal** to update card and billing details, view invoices and cancel. The server checks that the caller is the owner of the customer they asked about. | `Subscription.js`, `register/src/app.js` `POST /portal` |
| BILL-02 | Show the billing terms: plans are billed monthly in arrears; cancelling stops renewal but doesn't refund the current period. Plan changes and ending a trial early go through support. | `Subscription.js` |
| BILL-03 | Returning from the portal with the browser's back button must not leave the button stuck on "please wait". | `useResetOnBfcacheRestore.js` |
| BILL-04 | **Direct debit via GoCardless:** for invoices set to "send invoice" whose subscription metadata carries a GoCardless `mandateId`, a payment for the amount due is created against the mandate when the invoice is finalised (only if the mandate is active or submitted, and only for amounts above zero). | `goCardlessPayment/src/index.js`, `paymentHelpers.js` |
| BILL-05 | **Metered overage billing:** once a day, for each live subscription on a metered price, the previous day's request count is reported to Stripe as a usage record. The count is taken from API Gateway, capped by `ApiDailyUsageStats` (which excludes sandbox calls). Non-metered (for example annual) items are skipped. | `metering/src/metering.js` (daily, about 01:05–02:05 UTC) |

### 5.4 Custom offers

| ID | Requirement | Source |
|---|---|---|
| OFF-01 | A customer may have a bespoke offer (price per month, price per request, free requests, number of users, expiry). Offers that haven't expired or been accepted appear on their Subscriptions tab with an "accept" button that goes to Stripe Checkout and replaces their current subscription. | `src/components/Offer.js`, `dashboard.js` |
| OFF-02 | A customer may only read their own offer. | `offer/src/app.js` |

> **Gap:** offers are broken end to end today. The admin form writes `{UserId: cus_…, customPrice, discountPercent, expiryDate: "YYYY-MM-DD"}`, but the dashboard reads `/offer/{cognitoSub}` and expects `{productId, pricePerMonth, pricePerReq, freeRequests, numberOfUsers, expiryDate: epoch}`. See `docs/admin-dashboard-plan.md` Phase 5. The rewrite should define one offer model, probably as "an admin assigns a specific Stripe price, with an expiry, to a customer".

### 5.5 Team management (dashboard "Team" tab)

| ID | Requirement | Source |
|---|---|---|
| TEAM-01 | The Team tab appears only when the user has `custom:teamsEnabled` set. **Nothing in the code sets it;** it is set by hand in Cognito. | `dashboard.js` |
| TEAM-02 | List the team: the owner (marked "Team Admin"), members, and pending invites (marked "Invited"). Any team member can view the list. | `src/components/Team.js`, `teamMembers/src/app.js` |
| TEAM-03 | Show seats used against the limit. The limit is `maxTeamSize + extraUsers`, owner included. Pending invites take a seat. | `Team.js`, `amplify/shared/seats.cjs` |
| TEAM-04 | **Only the owner can invite.** The invite form takes the part before the `@`; the domain is fixed to the owner's own email domain. The owner must have set a company name first. | `Team.js`, `team/src/index.js` |
| TEAM-05 | An invite is refused with "Your team is full (X of Y seats used)" when members plus pending invites already fill the limit. A team with no recorded limit is let through. | `team/src/index.js` |
| TEAM-06 | **If the invitee already has a Mintly account,** they are added straight away: their `customerId`, `apiKeyId` and company name are overwritten with the team's, and they get a "you've been linked to a team" email. | `team/src/index.js` |
| TEAM-07 | **Otherwise,** a pending invite is stored and an email with a `/join?invite=<token>` link is sent (§4.4). | `team/src/index.js` |
| TEAM-08 | **Only the owner can remove** a member or withdraw an invite, only from their own team, and never themselves. A removed user's team attributes are cleared so they lose access to the key and tools. | `Team.js`, `leaveTeam/src/removal.js`, `teamMembers` delete |
| TEAM-09 | Members who aren't the owner get a clear 403 message if they try to invite or remove. | `team`, `leaveTeam` |

> **Gaps:** invites never expire. An existing user who is invited is moved into the team without being asked, losing any link they had before. There is no "transfer ownership". Teams over their limit through SSO are only flagged, not prevented.

---

## 6. API-only users: keys and documentation

These users mostly want the key and the docs. They sign up and subscribe the same way as an account owner (§5.1), and may never use the Tools page.

### 6.1 Getting and using the key

| ID | Requirement | Source |
|---|---|---|
| API-01 | Retrieve and copy the API key from the dashboard (SUB-03). | `Subscription.js` |
| API-02 | The key is sent as the `x-api-key` header. Production base URL: `https://api.mintly.uk/bankAccount/v1`. Sandbox: `https://sandbox.mintly.uk/bankAccount/v1`, with fixed test values. | `skills/mintly-api/SKILL.md` |
| API-03 | Endpoints in front of customers: `GET /sortcode/{sortCode}`, `GET /sortcode/{sortCode}/account/{accountNumber}`, `GET /iban/{iban}`, `GET /swift/{bic}`, `GET /identity`. These are served by the API platform, not this app. | `public/assets/swagger.yaml` |
| API-04 | Quotas and throttling are per usage plan (per price), enforced by API Gateway. The portal has to put each customer's key in the right plan (PROV-01, PROV-05). | `register`, `adminCustomers` |
| API-05 | There is no self-service key rotation. Customers contact support. | `Subscription.js` |
| API-06 | Monitor usage (§4.3). | `monitor.js` |

### 6.2 Documentation and developer resources (public)

| ID | Requirement | Source |
|---|---|---|
| DOC-01 | `/docs`: the Bank Account Checker API reference rendered with ReDoc from `public/assets/swagger.yaml`, with downloadable YAML and JSON specs. The specs are synced and linted at build time. | `src/pages/docs.js`, `src/components/docs/`, `scripts/sync-openapi.mjs`, `scripts/lint-openapi.mjs` |
| DOC-02 | `/eiscd-docs` and `/eiscd-docs/[frequency]/[version]`: EISCD API references (weekly v1 and v2, monthly v2) with a spec picker. | `src/pages/eiscd-docs*.js`, `public/assets/eiscd-openapi-*.yaml` |
| DOC-03 | Downloadable "agent skills" (zip bundles for AI coding assistants) for both APIs, built from `skills/`. Downloads are tracked in GA. | `scripts/package-skill.js`, `ApiDocsPage.js` |
| DOC-04 | Integration guides: Node.js, Python, C#, Power Automate, Zapier, Salesforce, and an MCP server in Python. | `src/pages/integration-guides/` |
| DOC-05 | Release notes page. | `src/pages/release-notes.js` |
| DOC-06 | Postman collection, Data Processing Addendum PDF and other downloads. | `public/assets/docs/` |
| DOC-07 | Sample EISCD fetch scripts (JS and Python). | `scripts/Fetch-EISCD.*` |

### 6.3 EISCD customers

| ID | Requirement | Source |
|---|---|---|
| EIS-01 | EISCD is sold as an annual licence (weekly or monthly plan) through a demo or call booking, **not** self-serve checkout. | `src/components/EiscdProduct.js`, `src/pages/eiscd.js` |
| EIS-02 | EISCD subscriptions in Stripe are ignored by the webhook and excluded from the admin views. Their keys are provisioned **outside this app** (manually). | `register/src/app.js`, `adminCustomers/src/drift.js` |

> **Open question Q5:** should EISCD customers get portal access (key retrieval, usage) in the new app, or stay manual?

---

## 7. Visitors: public site (brief)

The marketing site is deployed with the portal, so the rewrite has to carry it too. It is mostly static content.

### 7.1 Content and SEO

| ID | Requirement | Source |
|---|---|---|
| WEB-01 | Marketing pages: home, features, bank-account-validation-api, sort-code-checker, pricing, pricing-calculator, pricing-comparison, get-started, ai-agents, eiscd, eiscd-api, about, faq, articles (11), integration guides, links, plus legal pages (terms, eiscd-terms, privacy, modern-slavery). | `src/pages/` |
| WEB-02 | Per-page SEO: title, description, canonical, Open Graph image, JSON-LD structured data (Organisation, Product, FAQ, HowTo, Breadcrumb), `noindex` on portal pages. | `src/components/seo.js`, `StructuredData.js` |
| WEB-03 | **Keep every existing URL** and the 30+ permanent redirects for legacy paths (for example `/check-bank-account` → `/sort-code-checker`). | `next.config.mjs` |
| WEB-04 | Security headers on every response: HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy, X-Content-Type-Options and a Content-Security-Policy that allows the third parties in §9. | `customHttp.yml` |
| WEB-05 | Price calculator that recommends a plan from expected monthly volume. | `src/components/PriceCalculator.js`, `src/utils/priceCalculator.js` |
| WEB-06 | Cookie consent banner; Google Analytics and Meta Pixel page views; Tawk.to live chat; Cal.com "book a demo" embed. | `src/pages/_app.js`, `CookieConsentBanner.js`, `ChatWrapper.js`, `BookDemoButton.js` |
| WEB-07 | Accessibility: axe checks in development; WCAG-minded markup (labels, aria). | `src/utils/reportAccessibility.js` |

### 7.2 Free sort code checker ("Try it")

| ID | Requirement | Source |
|---|---|---|
| FREE-01 | Visitors can check a sort code, with an optional account number, without signing up. The response shows only VALID or INVALID and the bank name. | `src/components/TryIt.js`, `validate/src/index.js` |
| FREE-02 | Protected by reCAPTCHA (checked on the server, including that the hostname matches) and an origin allow-list. | `validate/src/index.js` |
| FREE-03 | **Rate limit:** 10 checks per IP per week (resetting Monday), and at least 2 seconds between requests, enforced on the server (the `IpAddress` table). A cookie mirrors the count in the browser. Over the limit: 429 with a prompt to subscribe. | `validate`, `tryItLogic.js` |
| FREE-04 | After the 3rd check, ask for a 1–5 rating with optional feedback (stored in the `ToolRating` table, asked once). From the 8th check, show a discount or upgrade offer. | `tryItLogic.js`, `toolRating/src/index.js` |
| FREE-05 | The checker calls the production API with a dedicated trial API key held on the server. | `validate/src/index.js` |

### 7.3 Lead capture

| ID | Requirement | Source |
|---|---|---|
| LEAD-01 | **Qualification enquiry:** a step-by-step questionnaire (use case, volume and so on) that recommends a plan, or says Mintly isn't the right fit, or offers a call. Contact details are sent, reCAPTCHA-protected, to `info@mintly.uk`, with an auto-reply to the enquirer. The steps are tracked in GA. | `src/components/Enquiry.js`, `src/utils/enquiryQualification.js`, `enquiry/src/index.js`, `docs/enquiry-qualification-spec.md` |
| LEAD-02 | **Email capture** (on `/links`) adds the address to the Brevo list. | `RegisterEmail.js`, `registerEmail/src/index.js` |

---

## 8. Mintly admins: managing the system

Admin access comes from membership of the Cognito group `admin`, checked **on the server** for every admin route. The UI hides admin entry points from everyone else (`useIsAdmin` reads `cognito:groups`). Admin pages: `/admin`, and an Admin tab on the dashboard.

### 8.1 Customers

| ID | Requirement | Source |
|---|---|---|
| ADM-01 | **Customer list:** every customer, merging the DynamoDB subscription records with every Stripe subscription (paged past DynamoDB's 1 MB scan limit). Emails come from Stripe. Customers found on only one side are included and labelled. | `adminCustomers/src/customerViews.js`, `src/components/AdminCustomerList.js` |
| ADM-02 | Columns: customer, plan name and interval, Stripe status, DynamoDB status, trial or renewal date, extra users, drift count. Search, sortable columns, and status filters: all, trialing, active, cancelling, past due, expired, and "Needs attention (drift)". | `AdminCustomerList.js` |
| ADM-03 | **Customer detail:** the full stored record next to what Stripe says it should be, with each mismatched ("drifted") field highlighted; every Stripe subscription, current one marked; team members and invites with "X of Y seats used" (flagged when over); API key state and usage plans (**never the key value**); links to the customer and subscription in Stripe (test-mode links outside production). | `AdminCustomerDetail.js`, `adminCustomers/src/drift.js` |
| ADM-04 | **Per-customer usage chart** with the same date ranges as the customer's monitor. | `src/components/Admin.js` |
| ADM-05 | **Resync from Stripe:** preview, then apply. The preview lists the record changes, the key actions (put the key in exactly the expected usage plan; enable it while live; disable it and remove it from plans once ended) and blockers. Apply re-plans from fresh data and refuses if the record changed since the preview. Key actions run first; a failure stops before the record is touched. The key is never replaced, so team members' links stay valid. | `adminCustomers/src/resync.js`, `ResyncModal.js` |
| ADM-06 | Resync blockers: no stored record, no subscription or one belonging to another customer, EISCD, price missing usage-plan metadata, no key or a deleted key. | `resync.js` |
| ADM-07 | **Audit log:** every resync and failed resync is recorded (admin email, changes, key actions, time). The detail page shows the latest 20 as "Admin history". | `AdminAudit` table, `AdminCustomerDetail.js` |

### 8.2 Plan catalogue

| ID | Requirement | Source |
|---|---|---|
| ADM-08 | **Plans tab:** every recurring Stripe price tagged as a plan (`mintlyPlan=true`) or held by a live customer, with billing interval, tier, seats, usage plans and customer count. | `adminCustomers` `GET /admin/plans`, `AdminPlans.js` |
| ADM-09 | Flag prices with no plan tag, no `maxTeamSize`, a missing usage plan (which breaks the webhook), or a usage plan API Gateway doesn't have. Also list live customers on prices Stripe didn't return, and usage plans no price uses. | `adminCustomers/src/planCatalogue.js` |
| ADM-10 | **Stripe is the source of truth for plans.** Price metadata carries `mintlyPlan`, `tier`, `maxTeamSize`, `usagePlanId` and `trialUsagePlanId`. A script writes these from `priceCatalogue.js` (dry run by default). | `scripts/stripe-plan-metadata.mjs` |

### 8.3 Offers

| ID | Requirement | Source |
|---|---|---|
| ADM-11 | Create, list and delete custom offers for a customer: plan, custom monthly price or discount %, expiry, message. Admin-only on the server. | `AdminOfferForm.js`, `AdminOfferList.js`, `offer/src/app.js` |

(See the gap under §5.4: this doesn't currently connect to what customers see.)

### 8.4 Admin tasks done outside the app today

The rewrite should decide which of these move into the admin UI. Most of them are listed as later phases in `docs/admin-dashboard-plan.md`.

| Task | How it is done today |
|---|---|
| Grant or revoke admin | Add the user to the Cognito `admin` group in the AWS console |
| Enable the Team tab for a customer | Set `custom:teamsEnabled` in the Cognito console |
| Fix an owner without `isTeamAdmin` | Set the attribute in the Cognito console |
| Change plan or interval, extra seats, extend a trial, cancel | Edit in the Stripe dashboard, then Resync (ADM-05) |
| Rotate or re-enable an API key | AWS console |
| Set up an SSO tenant | Code change and deploy, plus a manual DynamoDB row (SSO-07) |
| Provision an EISCD customer | Manual (EIS-02) |
| Retire a replaced subscription | Stripe CLI cancel with the "Automatically cancelled by upgrading" comment |
| Look at ratings, enquiries and sign-ups | DynamoDB console and the `info@` inbox |

---

## 9. Background processes and integrations

| ID | Process | Trigger | What it does | Source |
|---|---|---|---|---|
| SYS-01 | Stripe subscription webhook | Stripe events: `checkout.session.completed`, `customer.subscription.updated`/`.deleted`, `invoice.paid`, `invoice.payment_failed` | Provisioning and lifecycle (§5.2) | `register` `POST /webhook` |
| SYS-02 | GoCardless collection | Stripe `invoice.finalized` (separate webhook) | Direct debit collection (BILL-04) | `goCardlessPayment` |
| SYS-03 | Metered billing | Daily schedule | Report yesterday's usage to Stripe (BILL-05). **The usage-plan list is hard-coded.** | `metering` |
| SYS-04 | Usage reporter | Hourly | Copies API Gateway usage into the `Usage` table. **Nothing reads that table**, so it is probably droppable. | `usageReporter` |
| SYS-05 | AWS Marketplace notifications | SQS (from SNS) | `subscribe-success`, `unsubscribe-pending` (disable key), `unsubscribe-success` (expire), `subscribe-fail`. Updates the subscription record and the key. | `notificationHandlerService` |
| SYS-06 | Cognito pre-sign-up | Sign-up | Work-email denylist (AUTH-04) | `mintlywebPreSignup` |
| SYS-07 | Cognito post-confirmation | Account confirmed | Admin notification email (AUTH-07); SSO tenant linking (SSO-05) | `mintlywebPostConfirmation` |
| SYS-08 | Transactional email (SES, from `no-reply@` / `info@mintly.uk`) | Various | Team invite; "linked to team"; new customer to admin; new user to admin; enquiry plus auto-reply | `team`, `register`, `mintlywebPostConfirmation`, `enquiry` |
| SYS-09 | Marketing list (Brevo) | Subscribe, trial to paid, cancel, email capture | Add, update or remove contacts | `register/src/brevoHelpers.js`, `registerEmail` |

External services the new app has to work with:
- **Stripe:** test and live accounts
- **AWS API Gateway:** keys and usage plans, for as long as the APIs stay on AWS
- **DynamoDB `ApiDailyUsageStats`:** written by the API platform
- **GoCardless**
- **Brevo**
- **An email provider:** SES today
- **Google reCAPTCHA** (v2 invisible)
- **Google Analytics and Google Ads conversion tracking**
- **Meta Pixel**
- **Tawk.to**
- **Cal.com**
- **AWS Marketplace** (SQS)

Secrets live in AWS Secrets Manager under `mintly/<env>/{stripe_sk, brevo, gocardless, …}`.

---

## 10. Data

### 10.1 Current entities

| Entity (table) | Key | Holds | Notes for Supabase |
|---|---|---|---|
| User (Cognito) | `sub` | email, names, phone, `custom:companyName`, `customerId`, `apiKeyId`, `isTeamAdmin`, `teamsEnabled`, `marketingOptOut`, `acknowledgement`; `admin` group | Split into `profiles` (personal fields) and an `organisation_members` join (role: owner/member). Admin as a role or flag. |
| Customer | `customerId` | Created at checkout; holds almost nothing | Becomes `organisations` (one per Stripe customer) |
| ProductSubscription | `customerId` (one row per customer) | `productCode` (actually the Stripe price ID), `usagePlanId`, `apiKeyId`, `subscriptionId`, `subscriptionItemId`, `subscriptionExpired`, `subscriptionExpiryDate`, `trialing`, `extraUsers`, `maxTeamSize`, `created` | `subscriptions`, keyed to the organisation. Keep the derive-from-Stripe logic (`amplify/shared/subscriptionRecord.cjs`). |
| team | `customerId` + `inviteId` | invite email, created and accepted dates | `invitations` plus `organisation_members` |
| TenentSSOProviders | `domain` | IdP name, `customerId` | `sso_domains` (domain → organisation, provider) |
| Offer | `UserId` | No fixed schema (see the gap in §5.4) | `offers` with a defined schema |
| AdminAudit | `targetId` + `at` | actor, action, before/after, key actions | `admin_audit` |
| IpAddress | IP + week | free-checker counts | `free_check_rate_limits` (or Vercel KV/Upstash) |
| ToolRating | id | rating, feedback, time | `tool_ratings` |
| Usage | apiKeyId + date | hourly copy, unused | Drop |
| ApiDailyUsageStats (external) | `ApiKey` + `Date` | Success, NotFound per day | Read from AWS, or sync into Supabase (Q3) |

### 10.2 Rules the data model must keep

- One live subscription per organisation (BUY-05).
- One API key per organisation, shared by all its members. Moving or disabling the key changes access for the whole team.
- Seat limit = `maxTeamSize` (from the price) + `extraUsers` (from the subscription), owner included. Pending invites count.
- Stripe is the source of truth for prices and subscriptions; the database is a cache that can be rebuilt by resync.
- Every admin write is audited.

---

## 11. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-01 | **Server-side authorisation everywhere.** Every route works out the caller from the verified session and never trusts IDs in the path or body. (The Phase 0 security fixes in `docs/admin-dashboard-plan.md` show what goes wrong otherwise.) In Supabase this means row-level security on every table, plus server-only routes for anything touching Stripe, API Gateway or other users. |
| NFR-02 | **Secrets stay on the server** and in environment variables. Today the free checker's trial API key is hard-coded in `validate/src/index.js`. It should move to an environment variable (and be rotated) as part of the rewrite. |
| NFR-03 | **Two environments at least:** staging (Stripe test mode, staging URL) and production ("release", Stripe live). Preview deployments must not be able to hit live Stripe or production keys. |
| NFR-04 | **Webhooks are idempotent:** Stripe re-delivers events, and a retry must not mint a second key or double-provision (see commit `6b4c29d`). |
| NFR-05 | **UK and EU data residency** where possible (today eu-west-2, London). Choose the Supabase region and Vercel function region to match. GDPR: Data Processing Addendum offered; account deletion should erase personal data (ACC-04 gap). |
| NFR-06 | **Observability:** structured logs for webhooks, key moves and admin actions; alerting on webhook failures (none today beyond CloudWatch logs). |
| NFR-07 | **Testing and CI:** keep lint, unit tests for the pure logic (seats, drift, subscription record, pending plan, price calculator, enquiry qualification, try-it logic) and a production build on every PR. Today there are about 770 tests across frontend and backend. |
| NFR-08 | **Performance and SEO:** marketing pages statically generated; Core Web Vitals reported; no layout shift on the sign-in and plan-confirmation flows. |
| NFR-09 | **Cost and maintainability:** this is the reason for the rewrite. One deployable app (Next.js on Vercel) instead of about 22 Lambdas and 12 API Gateway APIs; no Amplify CLI; shared code in the app instead of copied into each Lambda (`scripts/sync-lambda-shared.mjs`). |

---

## 12. Migration considerations

### 12.1 Users and authentication (under 100 users)

- **Passwords can't be exported from Cognito.** The options are:
  1. Ask everyone to reset their password (or use a magic link) on first sign-in to the new app. This is simplest, and acceptable at under 100 users with notice.
  2. Lazy migration: on a user's first sign-in to the new app, check their password against Cognito, then create the user in Supabase with it.
- **Preserve identity links.** Map each Cognito `sub` to the new user ID, and carry over the `customerId`, `apiKeyId` and owner/member role into the new organisation and membership tables. Re-create the `admin` group as an admin role.
- **SSO tenants** need re-creating against the new auth provider. Supabase Auth supports SAML SSO on paid plans (check the current plan requirements). Each tenant will have to update their IdP with the new ACS URL and entity ID, so they need early, coordinated notice.
- **Rebuild the sign-up rules:** the work-email denylist (AUTH-04), T&C acknowledgement and marketing opt-out (AUTH-05/06), the admin notification on new user (AUTH-07) and SSO domain linking (SSO-05). In Supabase these could be an Auth hook or a database trigger.
- **Session cut-over:** everyone has to sign in again once.

### 12.2 APIs and AWS dependencies

- The Bank Account Checker and EISCD APIs, their keys, usage plans, throttling and usage stats **stay on AWS** unless they are migrated separately. The new app therefore still needs a narrowly scoped IAM user or role (from Vercel) to:
  - create, read, enable and disable API Gateway keys
  - manage usage plan keys
  - read API Gateway usage
  - read `ApiDailyUsageStats`
- Customers' **existing API keys must keep working** through and after cut-over. Their key IDs go into the new database unchanged.

### 12.3 Billing and webhooks

- Point the Stripe webhook endpoints (subscription lifecycle, and GoCardless collection) at the new app at cut-over. Pause or replay events across the switch so none are lost.
- Move the scheduled jobs to Vercel Cron or Supabase scheduled functions: daily metering, and the free-checker rate limit store.
- **AWS Marketplace** notifications come through SQS, which Vercel can't subscribe to directly. Either keep a small Lambda that forwards them to the new app, or retire the Marketplace listing (Q4).

### 12.4 Site

- Keep every URL, redirect, canonical and structured-data block (WEB-02, WEB-03) to protect search rankings.
- Recreate the security headers and CSP (WEB-04) in `next.config` or `vercel.json`.

---

## 13. Known gaps to fix rather than port

1. Offers: the admin form and the customer view don't agree (§5.4).
2. `custom:teamsEnabled` is set by hand, so teams are invisible until an admin intervenes (TEAM-01).
3. Account deletion leaves data in Stripe, Brevo and the team table, and doesn't handle team owners (ACC-04).
4. Invites never expire; an invited existing user is moved into a team without consent (§5.5).
5. Key rotation, plan changes, extra seats and trial extensions need the AWS or Stripe consoles (§8.4).
6. Usage-plan IDs are hard-coded in `metering` and `usageReporter`, and the EISCD price ID in the webhook.
7. The `Usage` table and `usageReporter` are unused; `setCookie` is an unused stub.
8. The free checker's API key is hard-coded in source (NFR-02).
9. Team members see and can copy the organisation's API key, and the Tools page sends it from the browser (TOOL-02).
10. SSO tenant set-up needs a code change and deploy (SSO-07).

---

## 14. Decisions

These were the open questions in draft 1. [`rewrite-plan.md`](./rewrite-plan.md) §1 explains what each decision means for the build.

| # | Question | Decision |
|---|---|---|
| Q1 | Should "portal user" and "API user" become real roles? | **Yes:** Owner (billing, team, key), Developer (key, docs, usage), Member (tools and usage; never sees the key) |
| Q2 | Should the Tools page call the API through a server-side proxy? | **Yes:** the key stays on the server, and checks are logged per user |
| Q3 | Read usage stats live from DynamoDB, or sync them into Supabase? | **Nightly sync into Supabase** |
| Q4 | What happens to the AWS Marketplace integration? | **Retire it** |
| Q5 | Should EISCD customers get portal access? | **Yes, for the key and usage.** Admins provision it; still no online checkout. |
| Q6 | Which auth provider? | **Supabase Auth**, including SAML SSO |
| Q7 | Which email providers? | **Resend** for transactional email; **Brevo** stays for the marketing list |
| Q8 | Which console-only admin tasks are needed at launch? | **All of them:** admins and teams, API key operations, subscription changes, SSO tenant set-up |
| Q9 | Are the APIs themselves in scope? | **No.** They stay on AWS, reached through one adapter module. |
| Q10 | What happens to the marketing site? | **It moves into the same app and is redesigned**, keeping every URL |

---

## 15. New requirements

These aren't in the current app. They come from problems with today's platform. The design for each is in [`rewrite-plan.md`](./rewrite-plan.md) §6.11 and §6.12.

### 15.1 Trial approval

**Problem:** scammers sign up and use the free trial. Today a production key is created as soon as a trial checkout completes (`PROV-01`).

| ID | Requirement |
|---|---|
| APPR-01 | A new organisation starting a free trial must not get a production API key or production checks until a Mintly admin approves it. |
| APPR-02 | Sign-ups that can be trusted are approved automatically, and the reason is recorded: a trusted domain, the domain of an existing approved organisation or SSO tenant, joining an approved organisation, or an admin-created subscription. Card details play no part, because free trials take no card. |
| APPR-03 | While pending, users can sign in, see that their account is being reviewed and how long it usually takes, read the docs, and try the tools against the sandbox. |
| APPR-04 | Admins are notified of each pending trial and see a review queue with signals that help spot abuse: domain and company details, previous trials from the same domain, email or IP, and sign-up location. |
| APPR-05 | Admins can approve, ask for more information, or decline. They can also add the domain to a trusted or blocked list. Every decision is audited and the owner is emailed. |
| APPR-06 | The 14-day trial starts when the organisation is approved, not when it signed up. |
| APPR-07 | Declining cancels the Stripe trial without charge. Pending trials expire after a set time, and admins get a reminder before then. |
| APPR-08 | Admins can suspend an approved organisation if abuse is found later (key disabled) and reinstate it. |

### 15.2 Changing plan

**Problem:** customers start a Starter trial and then need a bigger plan. Today they get a "you already have a subscription" error and must contact support (`BUY-05`, `BILL-02`), and support changes Stripe by hand.

| ID | Requirement |
|---|---|
| PLAN-01 | The account owner can change plan themselves. A plan change updates the existing subscription and keeps the same API key. |
| PLAN-02 | During a trial, the owner can switch to any tier and keep the remaining trial days, at no charge. |
| PLAN-03 | During a trial, once the organisation is approved, the owner can start paying straight away on any tier and billing interval, adding a card if there isn't one. This ends the trial's daily limit. |
| PLAN-04 | On a paid plan, upgrades take effect at once with a prorated charge. Downgrades take effect at the end of the billing period and can be cancelled before then. |
| PLAN-05 | Before confirming any change, the owner sees exactly what will be charged today and on the next invoice. |
| PLAN-06 | A downgrade that leaves fewer seats than the team uses is blocked until people are removed. A downgrade below recent usage is allowed, with a warning about overage. |
| PLAN-07 | The app recommends a plan from the organisation's usage and team size, and suggests upgrading when a quota, rate limit or seat limit is reached. Users who aren't owners can notify their owner. |
| PLAN-08 | Trial customers are reminded before the trial ends, with a link to choose a plan. |
| PLAN-09 | Admins can make the same change in one action, with extra options: any price including custom ones, keep, end or extend the trial, choose how to prorate, and apply now or at renewal. |
| PLAN-10 | Every plan change is recorded (who, from, to, when, amount) and confirmed to the owner by email. Custom-priced customers and those above the self-serve ceiling are sent to talk to Mintly instead. |
| PLAN-11 | Customers can't buy extra seats. Only admins can set them. |

### 15.3 From the gap review

These came from reviewing the plan from the point of view of each role. The design for each is in [`rewrite-plan.md`](./rewrite-plan.md) §6.13.

| ID | Requirement | Why |
|---|---|---|
| SEC-01 | Mintly admins must use multi-factor authentication (an authenticator app). Customers can turn it on for themselves. | An admin account can change any customer's plan, key or team |
| LEGAL-01 | Record which version of the terms and the privacy policy each user accepted, and when. Changes are announced by email; users aren't asked to accept again in the app. | Evidence of what each customer agreed to |
| BILL-06 | When a payment fails, the owner and billing contacts are emailed straight away, and the portal shows a banner linking to update the payment method. The key stays live until Stripe ends the subscription after its retries. Admins can see past-due organisations. | Today a failed payment is ignored and nobody is told |
| BILL-07 | Owners can add billing contacts (email addresses), a VAT number and a purchase order reference. Billing contacts receive invoices, receipts and payment reminders. They can't sign in and take no seat. | Finance teams need invoices without being portal users |
| BILL-08 | A customer who subscribes again after cancelling gets a new API key. The owner is told clearly, on screen and by email, that the previous key no longer works and integrations must be updated. | Today the key changes without warning |
| CANC-01 | Before the Stripe portal, owners who choose to cancel are asked (optionally) why, and are told plainly what happens: when the key stops working, how long their data is kept, and that coming back means a new key. Reasons are stored for admins. | Understand churn; avoid surprises |
| RET-01 | 24 months after an organisation's subscription ends, its personal data is deleted automatically: users, team and invitations, check log and contact details. The owner is emailed 30 days before. Minimal records (organisation, Stripe customer ID, dates) are kept for accounting; Stripe keeps its own records. | Data protection: don't keep personal data indefinitely |
| KEY-01 | Owners and developers can rotate the organisation's API key themselves, straight away or after a short overlap. The owner is always emailed and the rotation is audited. | A leaked key can be replaced without waiting for Mintly |
| ADM-12 | Admins can set up any customer, not just EISCD: create the organisation, choose any price including custom ones, choose card or invoice billing (optionally with a GoCardless mandate), set seats, optionally give a trial, and invite the owner. These organisations are approved automatically. | Enterprise customers are set up by hand in Stripe today |
| ADM-13 | Admins can view the portal as a chosen user sees it, read-only, to help with support questions. The key value stays hidden, nothing can be changed, and every use is audited. | Support without asking for screenshots |
| ADM-14 | A business dashboard for admins: sign-ups, trials pending, approved and declined, time to approve, trial-to-paid conversion, cancellations with their reasons, and recurring revenue by plan. | Run the business without exporting from Stripe |

**Considered and not needed:**
- users belonging to more than one organisation
- history of past checks, or storing results as evidence
- an activity log for owners
- more than one API key per organisation
- a sandbox key for each organisation

**Not needed at launch; could be added later:**
- usage alerts at 80% and 100% of quota
- alerts on unusual spikes in usage
- an overage cap
- usage export to CSV
- a status page and developer announcements
- a read-only support role for admins
- internal notes on organisations

---

## Appendix A: Route and endpoint inventory (current)

**Pages behind sign-in:**
- `/dashboard` (tabs: Subscriptions, Account, Team, Admin)
- `/tools`
- `/monitor`
- `/join`
- `/admin` (tabs: Customers, Plans, Offers)
- `/success`
- `/auth-callback`

**Backend endpoints:**

| API | Method and path | Who may call it |
|---|---|---|
| customer | `GET /{sub}` | Self |
| usage | `GET /{apiKeyId}?days=` | Key owner's organisation, or admin |
| subscription | `POST /subscribe` | Signed in |
| subscription | `POST /portal` | Account owner |
| subscription | `POST /webhook` | Stripe (signed) |
| team | `GET /team/{customerId}` | Team members |
| team | `PUT /team/add/{customerId}` | Owner |
| team | `PUT /team/join` | Invitee |
| team | `POST /team/remove`, `DELETE /team/object/{customerId}/{inviteId}` | Owner |
| offer | `GET /offer/{sub}` | Self |
| offer | list, `POST`, `PUT`, `DELETE` | Admin |
| admin | `GET /admin/customers`, `GET /admin/customers/{id}`, `POST /admin/customers/{id}/sync`, `GET /admin/plans` | Admin |
| identityProviders | `POST /provider/{domain}`, token exchange | Public (origin, reCAPTCHA and API key) |
| validate | `POST /sortcode/{sortcode}[/account/{account}]` | Public (origin, reCAPTCHA, IP limit) |
| enquiry | `POST /enquiry` | Public (reCAPTCHA) |
| registerEmail | `POST /registerEmail` | Public |
| toolRating | `POST /toolRating` | Public |
| goCardless | Stripe webhook | Stripe (signed) |
