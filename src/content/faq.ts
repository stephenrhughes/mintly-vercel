// The FAQ, as data (ported from mintly-web src/components/faqContent.js).
// The page groups, searches and counts these, and the FAQPage schema is
// built from the same answers people see. Plan facts come from plans.ts,
// so a price change doesn't have to be chased through the prose.
//
// Answers are trusted HTML written here. Where the new app works
// differently (plan changes are self-serve, every organisation has a
// team), the answer says what the new app does.

import { PLANS } from "@/lib/billing/plans";
import { FREE_CHECK_WEEKLY_LIMIT } from "@/lib/free-check/limits";
import { salesToAppHref } from "@/lib/hosts";
import { SALES_EMAIL, SUPPORT_EMAIL, SUPPORT_HOURS, SUPPORT_PHONE } from "@/lib/marketing/contact";

export type FaqCategory = { id: string; title: string; blurb: string };
export type FaqEntry = {
  id: string;
  category: string;
  question: string;
  /** Words people search with that the answer never says. */
  keywords: string;
  answer: string;
};

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: "getting-started",
    title: "Getting started",
    blurb: "Signing up, the free trial, and using Mintly without writing code.",
  },
  {
    id: "checking",
    title: "Checking accounts",
    blurb: "What a check does, what it proves, and what it doesn't.",
  },
  {
    id: "coverage",
    title: "Coverage & data",
    blurb: "The countries we cover, and where our data comes from.",
  },
  {
    id: "plans",
    title: "Plans & billing",
    blurb: "Choosing a plan, allowances, teams, cancelling and discounts.",
  },
  {
    id: "developers",
    title: "Developers & API",
    blurb: "Integrating, speed and rate limits, and connecting AI agents.",
  },
  {
    id: "support",
    title: "Security & support",
    blurb: "How we handle your data, and how to reach a human.",
  },
];

const { starter, standardPlus, professional } = PLANS;
const a = (href: string, text: string) => `<a href="${href}">${text}</a>`;
const ext = (href: string, text: string) => `<a href="${href}" rel="noopener">${text}</a>`;

export const FAQS: FaqEntry[] = [
  {
    id: "signing-up",
    category: "getting-started",
    question: "How do I sign up, and is there a free trial?",
    keywords: "register account create trial free start",
    answer: `<p>Sign up from the Start free trial button in the menu above, or ${a(salesToAppHref("/sign-up"), "create an account here")}. It takes a couple of minutes and you can run your first check straight away.</p>
<p>Every new customer gets a <strong>14-day free trial</strong> on the plan they choose, with access to all of Mintly's tools. There is no obligation to carry on afterwards, and you can cancel online from the Subscription page in your account.</p>
<p>Not sure where to start? ${a("/pricing", "Compare the plans")} - you can move up or down later.</p>`,
  },
  {
    id: "no-code",
    category: "getting-started",
    question: "I don't write code — can I still use Mintly?",
    keywords: "non-technical portal website zapier make power automate no code spreadsheet",
    answer: `<p>Yes. Our secure web portal lets you check sort codes and account numbers one at a time or in bulk, and shows you the account and branch data for each one. No programming involved - ${a("/features#web-tools", "see what the portal does")}.</p>
<p>You can also connect Mintly to software you already use without writing any code. Our ${a("/integration-guides/zapier-integration", "Zapier integration")} links Mintly to anything Zapier supports, and any automation tool that can call an HTTP service will work too - including ${a("/integration-guides/power-automate-integration", "Microsoft Power Automate")} and ${ext("https://www.make.com/en", "Make")}.</p>`,
  },
  {
    id: "bulk-checks",
    category: "getting-started",
    question: "Can I check a lot of accounts in one go?",
    keywords: "bulk batch csv upload spreadsheet file import export many",
    answer: `<p>Yes. Upload a CSV of sort codes and account numbers in the web portal and download the results with the bank, branch and supported payment types added to every row. It is the quickest way to clean a supplier or payroll file before a payment run.</p>
<p>If it is something you do regularly, the ${a("/get-started", "API")} is usually the better fit: the same checks, triggered from your own system, with no files to shuffle.</p>
<p>Bulk checks draw on your plan allowance just as single checks do.</p>`,
  },
  {
    id: "software-needed",
    category: "getting-started",
    question: "Do I need to install any software?",
    keywords: "browser install download windows mac requirements",
    answer: `<p>No. Mintly is hosted entirely in the cloud, so all you need is a modern web browser - we recommend one of the latest three versions of Chrome, Edge, Safari or Firefox. There is nothing to install, and nothing to keep updated.</p>`,
  },
  {
    id: "check-account-number",
    category: "checking",
    question: "How do I check a UK bank account number?",
    keywords: "validate modulus check digit account number verify",
    answer: `<p>Most UK bank account numbers are built using a set of mathematical algorithms. They let banks catch the two mistakes people actually make - transposing adjacent digits, or mistyping a single one - before a payment is routed to the wrong place.</p>
<p>To check an account number is valid you repeat the same ${a("/articles/modulus-checking", "modulus algorithm")} the bank used to create it. Mintly runs those algorithms against our directory of branches, confirms the sort code and account number go together, and returns the branch details. Doing that before a payment or a Direct Debit is the cheapest way to stop it failing.</p>
<p>Try it now with our ${a("/sort-code-checker", "free sort code and account checker")}, or read up on ${a("/articles/modulus-checking", "how modulus checking works")}.</p>`,
  },
  {
    id: "sort-code-swift-iban",
    category: "checking",
    question: "What is a sort code, SWIFT code and IBAN?",
    keywords: "bic swift iban sort code international payments difference",
    answer: `<p>A ${a("/articles/sortcodes", "sort code")} is a six-digit number identifying a single bank branch in the UK and Ireland. Sort codes change as branches open, merge and close, which is why the directory behind any checker has to be kept current.</p>
<p>A SWIFT code - also called a BIC, or Business Identifier Code - does the same job internationally. They are issued by ${ext("https://www.swift.com/", "SWIFT")} and identify a bank, and often a branch, anywhere in the world.</p>
<p>An ${ext("https://en.wikipedia.org/wiki/International_Bank_Account_Number", "International Bank Account Number")} (IBAN) is a standard format for identifying an account across borders. Not every country takes part, and each participant has its own length and layout - a country code, bank or branch codes and the account number, with a check digit so the whole thing can be validated.</p>
<p>Our article on ${a("/articles/swift-iban", "SWIFT and IBAN")} goes into more detail.</p>`,
  },
  {
    id: "what-valid-means",
    category: "checking",
    question: "What does a valid result actually tell me?",
    keywords: "valid meaning result open closed active exists payment types",
    answer: `<p>A valid result tells you three things:</p>
<ul><li>the sort code is a real branch in our directory;</li><li>the account number passes the modulus check published for that sort code;</li><li>the pair is correctly formed for the payment types that branch supports - BACS, CHAPS, Faster Payments and Direct Debit.</li></ul>
<p>The bank and branch details come back with it, so you can tell before you pay whether the route you intend to use will work.</p>
<p>What it does not tell you is whether the account is open, funded, or belongs to any particular person. Confirming the name is a separate service - see the next question.</p>`,
  },
  {
    id: "confirmation-of-payee",
    category: "checking",
    question: "Can I check who owns an account (Confirmation of Payee)?",
    keywords: "cop confirmation of payee name matching account holder owner fraud",
    answer: `<p>No - we don't match names. Checking that an account holder's name matches the one you hold is a separate service, Confirmation of Payee (CoP), offered by FCA Regulated Payment Service Providers connected to the Pay.UK CoP service. We aren't one of them.</p>
<p>What we do is the layer underneath: confirming the sort code and account number are real, correctly formed and reachable by BACS, Faster Payments, CHAPS or ICS.</p>
<p>The two work well together. Validation is fast and costs pence, so plenty of teams run it first and send only what survives to a CoP provider, which is priced per check and usually costs several times more.</p>`,
  },
  {
    id: "free-checker",
    category: "checking",
    question: "Is there a free sort code checker?",
    keywords: "free tool trial no account cost lookup",
    answer: `<p>Yes. Our ${a("/sort-code-checker", "free sort code and account checker")} gives you ${FREE_CHECK_WEEKLY_LIMIT} checks a week with no account needed &mdash; the same data and the same algorithms our paying customers use.</p>
<p>Beyond occasional use, every plan comes with an allowance of checks, starting at ${starter.includedRequests} a month on the ${starter.name} for ${starter.monthlyPrice}. ${a("/pricing", "See the plans")}.</p>`,
  },
  {
    id: "coverage",
    category: "coverage",
    question: "Which countries and account types can you check?",
    keywords: "countries coverage uk ireland germany europe sepa international global map",
    answer: `<h3>UK and Republic of Ireland</h3>
<p>Full validation of sort codes and account numbers, with data for every UK and Irish banking institution and the payment types each one supports.</p>
<h3>Germany</h3>
<p>Germany is an IBAN participant, so we validate all German bank accounts, and we hold branch data for the country as well.</p>
<h3>Rest of Europe</h3>
<p>We validate IBAN for every European country that takes part, and hold SWIFT/BIC data - including branch locations - for all SEPA member countries.</p>
<h3>Rest of world</h3>
<p>We validate IBAN for all participating countries worldwide, including the national check digit where one is used. We are steadily adding branch data for more international institutions.</p>
<p>This map shows our current coverage:</p>
<p><img src="/assets/img/theme/Mintly_coverage_Europe.webp" alt="Mintly's coverage of European countries" width="600" height="418" loading="lazy"></p>`,
  },
  {
    id: "data-source",
    category: "coverage",
    question: "Where does your data come from, and how often is it updated?",
    keywords: "eiscd vocalink source accuracy update weekly directory",
    answer: `<p>We are an Authorised Distributor for the Extended Industry Sort Code Directory (EISCD), and take an updated file from ${ext("https://www.vocalink.com/", "Vocalink")} every week - so branch closures and new sort codes reach you quickly.</p>
<p>Alongside it we curate our own data, gathered from national central banks and other sources, to cover the countries the EISCD does not.</p>
<p>The checks themselves use the current ${a("/articles/modulus-checking", "modulus checking algorithms")} - the same ones the banks use to generate account numbers in the first place.</p>`,
  },
  {
    id: "eiscd-licence",
    category: "coverage",
    question: "Can I licence the EISCD data file directly?",
    keywords: "eiscd licence license raw data file download distributor vocalink",
    answer: `<p>Yes. If you would rather hold the directory yourself than call an API, we can licence the ${a("/eiscd", "EISCD data file")} to you as an annual subscription, delivered on the schedule you need.</p>
<p>Pricing depends on how you will use it, how often you need it and how many sites it covers, so we quote it per customer. There is an ${a("/eiscd-api", "EISCD download API")} too, if you want the weekly file pulled automatically.</p>`,
  },
  {
    id: "which-plan",
    category: "plans",
    question: "Which plan is right for me?",
    keywords: "plan compare choose pricing tier best value volume",
    answer: `<p>There are ${a("/pricing", "three self-serve plans")}, and the right one is usually settled by how many checks you run a month:</p>
<ul><li><strong>${professional.name}</strong> - ${professional.monthlyPrice} a month, ${professional.includedRequests} checks included, ${professional.includedUsers}. For businesses running checks in volume.</li>
<li><strong>${standardPlus.name}</strong> - ${standardPlus.monthlyPrice} a month, ${standardPlus.includedRequests} checks included, ${standardPlus.includedUsers}. For smaller businesses and startups.</li>
<li><strong>${starter.name}</strong> - ${starter.monthlyPrice} a month, ${starter.includedRequests} checks included, ${starter.includedUsers.toLowerCase()}. For individuals and very small teams.</li></ul>
<p>Not sure? The ${a("/pricing-calculator", "price calculator")} works it out from your volume, and the ${a("/pricing-comparison", "plan comparison")} puts the features side by side. Above 300,000 checks a month we price by agreement - ask us for a bespoke quote.</p>`,
  },
  {
    id: "over-allowance",
    category: "plans",
    question: "What happens if I go over my included checks?",
    keywords: "overage excess extra usage limit invoice bill cost per check",
    answer: `<p>Nothing stops working. Checks beyond your monthly allowance are billed at your plan's per-check rate and appear on your next invoice:</p>
<ul><li>${professional.name} - ${professional.pricePerRequest} per extra check</li><li>${standardPlus.name} - ${standardPlus.pricePerRequest} per extra check</li><li>${starter.name} - ${starter.pricePerRequest} per extra check</li></ul>
<p>If you are regularly over, the next plan up is almost always cheaper than the overage - the ${a("/pricing-calculator", "price calculator")} shows you where the crossover falls. Past 50,000 checks a month we move you onto volume pricing instead.</p>`,
  },
  {
    id: "teams",
    category: "plans",
    question: "Can my whole team use one account?",
    keywords: "team users seats colleagues admin add user multiple people",
    answer: `<p>Yes &mdash; every plan caters for teams, and the account owner invites and removes members themselves.</p>
<ul><li>${professional.name} - ${professional.includedUsers}, including the owner</li><li>${standardPlus.name} - ${standardPlus.includedUsers}, including the owner</li><li>${starter.name} - ${starter.includedUsers.toLowerCase()}, with extra seats available</li></ul>
<p>Colleagues are invited by email at your company's domain, which is how we tie them to the same subscription. Ask us if you need to add a contractor or partner from another domain.</p>`,
  },
  {
    id: "cancel-or-change",
    category: "plans",
    question: "Can I change plan or cancel?",
    keywords: "cancel upgrade downgrade change plan notice contract refund renewal",
    answer: `<p>Yes, you can cancel from the Subscription page in your account. Monthly plans run for a minimum of one month and renew automatically; you can cancel at any time before the next renewal. Annual plans work the same way over a year.</p>
<p>Account owners can change plan themselves from the Subscription page: upgrades take effect straight away, and downgrades at the next renewal. Worth knowing: the 14-day free trial is for new customers, so upgrading or switching plan does not start a fresh one.</p>`,
  },
  {
    id: "discounts",
    category: "plans",
    question: "Do you discount for charities and educational institutions?",
    keywords: "charity education school university discount nonprofit reduced",
    answer: `<p>Very likely - we look at discounts for charities and education providers case by case, based on what you need and how much of it. Tell us about the project using the form below, or email ${a(`mailto:${SALES_EMAIL}`, SALES_EMAIL)}.</p>`,
  },
  {
    id: "partners",
    category: "plans",
    question: "Do you have a partner, reseller or affiliate programme?",
    keywords: "partner reseller affiliate referral commission revenue share",
    answer: `<p>We do. If you introduce customers to us we pay you a share of the revenue for as long as that customer stays with us - not a one-off finder's fee.</p>
<p>Send us a note using the form below, or email ${a(`mailto:${SALES_EMAIL}`, SALES_EMAIL)}, and we'll set out the terms.</p>`,
  },
  {
    id: "using-the-api",
    category: "developers",
    question: "How do I use your API?",
    keywords: "api rest integration developer sdk example code openapi docs",
    answer: `<p>Our API is a straightforward REST service, documented against OpenAPI 3.0, with example code so you or your engineers can be calling it inside an afternoon. Start with the ${a("/get-started", "get started guide")}, then the ${a("/docs", "API reference")}.</p>
<p>There are step-by-step ${a("/integration-guides", "integration guides")} for popular languages and tools, including ${a("/integration-guides/nodejs-integration", "Node.js")}, ${a("/integration-guides/python-integration", "Python")}, ${a("/integration-guides/csharp-integration", "C#")} and ${a("/integration-guides/salesforce-integration", "Salesforce")}.</p>`,
  },
  {
    id: "api-speed-limits",
    category: "developers",
    question: "How fast is the API, and are there rate limits?",
    keywords: "latency speed performance throttle rate limit uptime sla requests",
    answer: `<p>Typical responses come back in under 50ms, and we run to a 99.95% uptime target - with an SLA behind it on Enterprise plans.</p>
<p>Each plan carries a throttle, measured in checks a second:</p>
<ul><li>${professional.name} - ${professional.throttle} a second</li><li>${standardPlus.name} - ${standardPlus.throttle} a second</li><li>${starter.name} - ${starter.throttle} a second</li></ul>
<p>If your workload is burstier than that - a nightly payment run, say - talk to us and we will size it with you, rather than have you find the limit in production.</p>`,
  },
  {
    id: "ai-agents",
    category: "developers",
    question: "Can I connect an AI agent or MCP server to Mintly?",
    keywords: "ai agent mcp claude skill llm chatbot automation model context protocol",
    answer: `<p>Yes. See ${a("/ai-agents", "AI agents")} for the overview.</p>
<p>We publish an ${a("/docs#section/AI-agent-skill", "agent skill")} you can drop into Claude Code, which gives it everything it needs to build a Mintly client inside your own codebase, and a guide to ${a("/integration-guides/mcp-server-python", "building an MCP server")} so an assistant can run checks on request.</p>`,
  },
  {
    id: "data-security",
    category: "support",
    question: "Is my data secure, and what do you do with what I submit?",
    keywords: "security gdpr privacy encryption data residency retention logs compliance",
    answer: `<p>Everything is encrypted in transit and at rest. We are GDPR compliant and Cyber Essentials certified, and your data is processed in the UK.</p>
<p>We do not sell or share the account details you check. API transaction logs are typically kept for 7 days so we can monitor the service and detect misuse, then securely deleted or anonymised.</p>
<p>The full detail - what we hold, for how long, and your rights over it - is in our ${a("/privacy", "privacy policy")}.</p>`,
  },
  {
    id: "contact-support",
    category: "support",
    question: "How do I get help, and when are you around?",
    keywords: "support contact help email phone chat hours response human",
    answer: `<p>Email ${a(`mailto:${SUPPORT_EMAIL}`, SUPPORT_EMAIL)} for anything to do with your account, your bill, or a check that looks wrong. Include the sort code and account number you checked and we'll be able to answer first time.</p>
<p>For something quicker, live chat and the phone (${SUPPORT_PHONE}) are staffed during business hours: ${SUPPORT_HOURS}.</p>
<p>Pricing, volumes, partnerships and EISCD licensing go to ${a(`mailto:${SALES_EMAIL}`, SALES_EMAIL)}, or use the form below and we'll point you at the right thing.</p>`,
  },
];

/** Plain text from an answer, for search and for the FAQPage schema. */
export function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
