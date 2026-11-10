// The enquiry qualification flow (LEAD-01): questions, branching, routing
// and the cost-of-failure estimate. Ported from mintly-web
// src/utils/enquiryQualification.js; the reasoning behind each question is
// in docs/enquiry-qualification-spec.md.

import { PLANS, type PlanTier } from "@/lib/billing/plans";

export type Answer = string | string[];
export type Answers = Record<string, Answer | undefined>;
export type Contact = {
  name?: string;
  email?: string;
  company?: string;
  phone?: string;
  notes?: string;
};
export type Option = { value: string; label: string };
export type Question = {
  id: string;
  type: "single" | "multi" | "contact";
  prompt: string;
  help?: string;
  optional?: boolean;
  exclusiveOption?: string;
  options?: Option[];
  isVisible?: (answers: Answers) => boolean;
};
export type Outcome =
  | { type: "plan"; plan: PlanTier; reasons: string[] }
  | { type: "call"; meeting: "api" | "eiscd"; reasons: string[] }
  | { type: "enquiry"; reasons: string[] };

export const PRODUCT = "product";
export const CONFIRMS = "confirms";
export const VOLUME = "volume";
export const CADENCE = "cadence";
export const INTEGRATION = "integration";
export const FAILURES = "failures";
export const FAILURE_COST = "failureCost";
export const CONSTRAINTS = "constraints";
export const SECTOR = "sector";
export const EISCD_USE = "eiscdUse";
export const EISCD_FORMAT = "eiscdFormat";
export const EISCD_FREQUENCY = "eiscdFrequency";
export const EISCD_SITES = "eiscdSites";
export const CONTACT = "contact";

/**
 * True once the person is being qualified for a data file licence rather than
 * per-check API access — either because they said so at Q1, or because they
 * asked for the raw file at Q5.
 */
export const isEiscdBranch = (answers: Answers = {}) =>
  answers[PRODUCT] === "eiscd" || answers[INTEGRATION] === "file";

const isApiBranch = (answers: Answers) => answers[PRODUCT] !== "eiscd";

export const QUESTIONS: Question[] = [
  {
    id: PRODUCT,
    type: "single",
    prompt: "What are you looking to do?",
    options: [
      {
        value: "api",
        label: "Check that bank details are valid before I pay someone or collect a payment",
      },
      {
        value: "eiscd",
        label: "Hold the full UK sort code directory inside my own systems",
      },
      { value: "unsure", label: "Both, or I'm not sure yet" },
    ],
  },
  {
    id: CONFIRMS,
    type: "single",
    prompt: "What do you need to confirm?",
    isVisible: isApiBranch,
    options: [
      {
        value: "details",
        label: "That the sort code and account number are real and correctly formed",
      },
      {
        value: "name",
        label: "That the account holder's name matches the person I'm paying",
      },
      { value: "both", label: "Both of those" },
    ],
  },
  {
    id: VOLUME,
    type: "single",
    prompt: "Roughly how many checks would you need each month?",
    isVisible: isApiBranch,
    options: [
      { value: "lt250", label: "Fewer than 250" },
      { value: "250_10k", label: "250 to 10,000" },
      { value: "10k_25k", label: "10,000 to 25,000" },
      { value: "25k_50k", label: "25,000 to 50,000" },
      { value: "50k_plus", label: "More than 50,000" },
      { value: "unknown", label: "I don't know yet" },
    ],
  },
  {
    id: CADENCE,
    type: "single",
    prompt: "When would the checks happen?",
    isVisible: isApiBranch,
    options: [
      {
        value: "realtime",
        label: "One at a time, live, as someone enters their details",
      },
      {
        value: "batch",
        label: "In batches — a payroll run, a supplier file, monthly billing",
      },
      { value: "adhoc", label: "Occasional one-off lookups" },
      {
        value: "database",
        label: "Re-validating a database of accounts we already hold",
      },
    ],
  },
  {
    id: INTEGRATION,
    type: "single",
    prompt: "How would you want to connect?",
    isVisible: isApiBranch,
    options: [
      { value: "api", label: "Our developers would integrate the REST API" },
      {
        value: "nocode",
        label: "No code — Zapier, or upload a file to the secure portal",
      },
      { value: "file", label: "We want the raw data file to load into our own systems" },
      { value: "undecided", label: "Haven't decided yet" },
    ],
  },
  {
    id: EISCD_USE,
    type: "single",
    prompt: "What will you use the directory for?",
    isVisible: (answers) => answers[PRODUCT] === "eiscd",
    options: [
      { value: "validation", label: "Validating accounts inside our own systems" },
      {
        value: "routing",
        label: "Routing and clearing — which scheme a sort code supports",
      },
      { value: "enrichment", label: "Enriching branch or address data we hold" },
      { value: "reporting", label: "Reference data for reporting or reconciliation" },
      { value: "other", label: "Something else" },
    ],
  },
  {
    id: EISCD_FORMAT,
    type: "single",
    prompt: "Which format suits you?",
    isVisible: isEiscdBranch,
    options: [
      { value: "csv", label: "CSV" },
      { value: "txt", label: "TXT" },
      { value: "xml", label: "XML" },
      { value: "xlsx", label: "XLSX" },
      { value: "unsure", label: "Not sure yet" },
    ],
  },
  {
    id: EISCD_FREQUENCY,
    type: "single",
    prompt: "How often do you need it?",
    isVisible: isEiscdBranch,
    options: [
      { value: "weekly_full", label: "Weekly, full file" },
      { value: "weekly_changes", label: "Weekly, changes only" },
      { value: "periodic", label: "Monthly or quarterly" },
      { value: "one_off", label: "A single one-off extract" },
    ],
  },
  {
    id: EISCD_SITES,
    type: "single",
    prompt: "How many sites or data centres would use the data?",
    isVisible: isEiscdBranch,
    options: [
      { value: "one", label: "One" },
      { value: "two_five", label: "Two to five" },
      { value: "many", label: "More than five" },
      { value: "unsure", label: "Not sure" },
    ],
  },
  {
    id: FAILURES,
    type: "single",
    prompt: "Roughly how many payments a month fail because the bank details were wrong?",
    isVisible: (answers) => !isEiscdBranch(answers),
    options: [
      { value: "none", label: "None that we know of" },
      { value: "lt10", label: "Fewer than 10" },
      { value: "10_100", label: "10 to 100" },
      { value: "100_1000", label: "100 to 1,000" },
      { value: "1000_plus", label: "More than 1,000" },
      { value: "unknown", label: "No idea" },
    ],
  },
  {
    id: FAILURE_COST,
    type: "single",
    prompt:
      "And roughly what does one failure cost to put right — bank charges plus the time someone spends chasing it?",
    isVisible: (answers) =>
      !isEiscdBranch(answers) &&
      !["none", "unknown", undefined].includes(answers[FAILURES] as string | undefined),
    options: [
      { value: "lt5", label: "Under £5" },
      { value: "5_20", label: "£5 to £20" },
      { value: "20_50", label: "£20 to £50" },
      { value: "50_plus", label: "More than £50" },
      { value: "unknown", label: "Not sure" },
    ],
  },
  {
    id: CONSTRAINTS,
    type: "multi",
    optional: true,
    prompt: "Anything we should know before we reply?",
    help: "Choose any that apply.",
    exclusiveOption: "none",
    options: [
      { value: "security", label: "We'd need a security review or a DPA" },
      {
        value: "onprem",
        label: "The data needs to stay inside our own infrastructure",
      },
      {
        value: "procurement",
        label: "We buy through procurement — PO and invoice, not a card",
      },
      { value: "throughput", label: "We need more than 1,000 checks a minute" },
      { value: "teams", label: "Several people or teams would use it" },
      { value: "none", label: "None of these" },
    ],
  },
  {
    id: SECTOR,
    type: "single",
    optional: true,
    prompt: "What kind of business are you?",
    help: "Optional, but it tells us which examples are worth sending you.",
    options: [
      { value: "payroll", label: "Payroll bureau" },
      { value: "lender", label: "Lender or broker" },
      { value: "insurer", label: "Insurer" },
      { value: "accountancy", label: "Accountancy practice" },
      { value: "marketplace", label: "Marketplace or gig platform" },
      { value: "utility", label: "Utility or telco" },
      { value: "charity", label: "Charity" },
      { value: "software", label: "Software vendor building this into a product" },
      { value: "government", label: "Local or central government" },
      { value: "other", label: "Something else" },
    ],
  },
  {
    id: CONTACT,
    type: "contact",
    prompt: "Where should we send this?",
  },
];

const byId: Record<string, Question> = Object.fromEntries(
  QUESTIONS.map((question) => [question.id, question]),
);

export const getQuestion = (id: string): Question | undefined => byId[id];

/**
 * The questions this particular person should see, in order, given what they
 * have answered so far. Recomputed on every answer, so going back and changing
 * Q1 rebuilds the rest of the flow.
 */
export const getVisibleQuestions = (answers: Answers = {}): Question[] =>
  QUESTIONS.filter((question) => !question.isVisible || question.isVisible(answers));

export const getOptionLabel = (questionId: string, value: string): string =>
  byId[questionId]?.options?.find((option) => option.value === value)?.label ?? value;

/** Answering Q2 with anything involving name matching earns the CoP explainer. */
export const needsCopExplainer = (answers: Answers = {}) =>
  ["name", "both"].includes(answers[CONFIRMS] as string);

// Midpoints of the two bands. Deliberately conservative: the figure we show is
// an estimate built from someone's rough recollection, not a claim of ours.
const FAILURES_PER_MONTH: Record<string, number> = {
  lt10: 5,
  "10_100": 50,
  "100_1000": 400,
  "1000_plus": 1500,
};

const COST_PER_FAILURE: Record<string, number> = {
  lt5: 3,
  "5_20": 12,
  "20_50": 32,
  "50_plus": 65,
};

export const roundDownToTwoSignificantFigures = (value: number): number => {
  if (value <= 0) return 0;
  if (value < 10) return Math.floor(value);
  const magnitude = 10 ** (Math.floor(Math.log10(value)) - 1);
  return Math.floor(value / magnitude) * magnitude;
};

/**
 * Their own numbers, multiplied. Null whenever we don't have both bands — no
 * estimate, no figure, rather than a guess dressed up as one.
 */
export const estimateMonthlyFailureCost = (answers: Answers = {}): number | null => {
  if (isEiscdBranch(answers)) return null;

  const failures = FAILURES_PER_MONTH[answers[FAILURES] as string];
  const cost = COST_PER_FAILURE[answers[FAILURE_COST] as string];
  if (!failures || !cost) return null;

  return roundDownToTwoSignificantFigures(failures * cost);
};

export const formatPounds = (value: number) => `£${Math.round(value).toLocaleString("en-GB")}`;

const CALL_CONSTRAINTS: Record<string, string> = {
  security: "you'd need a security review or a DPA",
  procurement: "you buy through procurement rather than by card",
  throughput: "you need more than 1,000 checks a minute",
};

const VOLUME_TO_PLAN: Record<string, PlanTier> = {
  lt250: "starter",
  "250_10k": "standardPlus",
  "10k_25k": "professional",
};

/**
 * Where the flow ends up. Rules are evaluated in order and the first match
 * wins; see the routing table in the spec.
 */
export const getOutcome = (answers: Answers = {}): Outcome => {
  const constraints = (answers[CONSTRAINTS] as string[] | undefined) ?? [];

  if (isEiscdBranch(answers)) {
    return { type: "call", meeting: "eiscd", reasons: [] };
  }

  if (constraints.includes("onprem")) {
    return {
      type: "call",
      meeting: "eiscd",
      reasons: ["the data needs to stay inside your own infrastructure"],
    };
  }

  const callReasons = Object.entries(CALL_CONSTRAINTS)
    .filter(([constraint]) => constraints.includes(constraint))
    .map(([, reason]) => reason);

  if (callReasons.length > 0) {
    return { type: "call", meeting: "api", reasons: callReasons };
  }

  if (["50k_plus", "25k_50k"].includes(answers[VOLUME] as string)) {
    return {
      type: "call",
      meeting: "api",
      reasons: ["at your volume the per-check rate is worth a conversation"],
    };
  }

  if (answers[VOLUME] === "unknown" || !answers[VOLUME]) {
    return { type: "enquiry", reasons: [] };
  }

  return { type: "plan", plan: VOLUME_TO_PLAN[answers[VOLUME] as string], reasons: [] };
};

/** A stable identifier for the ending, for analytics and the email subject. */
export const getOutcomeId = (outcome: Outcome): string => {
  if (outcome.type === "plan") return `trial_${outcome.plan}`;
  if (outcome.type === "call") return `call_${outcome.meeting}`;
  return outcome.type;
};

const VOLUME_SUMMARY: Record<string, string> = {
  lt250: "under 250 checks/mo",
  "250_10k": "250–10k checks/mo",
  "10k_25k": "10k–25k checks/mo",
  "25k_50k": "25k–50k checks/mo",
  "50k_plus": "50k+ checks/mo",
  unknown: "volume unknown",
};

/**
 * The one-line summary that becomes the email subject, so an enquiry can be
 * triaged from the inbox list without opening it.
 */
export const getSummary = (answers: Answers = {}): string => {
  const outcome = getOutcome(answers);
  const parts: string[] = [];

  if (isEiscdBranch(answers)) {
    parts.push("EISCD licence");
  } else if (outcome.type === "plan") {
    parts.push(PLANS[outcome.plan].name);
  } else if (outcome.type === "call") {
    parts.push("Book a call");
  } else {
    parts.push("Enquiry");
  }

  if (!isEiscdBranch(answers) && answers[VOLUME]) {
    parts.push(VOLUME_SUMMARY[answers[VOLUME] as string]);
  }
  if (answers[SECTOR]) {
    parts.push(getOptionLabel(SECTOR, answers[SECTOR] as string).toLowerCase());
  }

  return parts.join(", ");
};

const formatAnswer = (question: Question, value: Answer | undefined): string => {
  if (question.type === "multi") {
    if (!Array.isArray(value) || value.length === 0) return "Not answered";
    return value.map((entry) => getOptionLabel(question.id, entry)).join("; ");
  }
  if (!value || Array.isArray(value)) return "Not answered";
  return getOptionLabel(question.id, value);
};

/**
 * A plain-text transcript for the notification email. Plain text rather than
 * HTML because the server escapes what it receives — the enquiry inbox should
 * not be rendering markup that came off a public form.
 */
export const formatTranscript = (answers: Answers = {}, contact: Contact = {}): string => {
  const lines = getVisibleQuestions(answers)
    .filter((question) => question.type !== "contact")
    .map((question) => `${question.prompt}\n  ${formatAnswer(question, answers[question.id])}`);

  const estimate = estimateMonthlyFailureCost(answers);
  if (estimate) {
    lines.push(
      `Estimated cost of failed payments\n  ${formatPounds(estimate)} per month (from the bands above)`,
    );
  }

  const details = [
    `Company: ${contact.company || "Not given"}`,
    `Email: ${contact.email || "Not given"}`,
    contact.phone?.trim() ? `Telephone: ${contact.phone.trim()}` : null,
  ].filter(Boolean);

  const notes = contact.notes?.trim();

  return [
    getSummary(answers),
    "",
    ...details,
    "",
    ...lines,
    notes ? `\nWhat they added\n  ${notes}` : null,
  ]
    .filter((line) => line !== null)
    .join("\n");
};

/** The structured payload, so answers are queryable rather than only readable. */
export const buildQualification = (
  answers: Answers = {},
  contact: Contact = {},
  sourcePage: string | null = null,
) => {
  const outcome = getOutcome(answers);
  const visible = getVisibleQuestions(answers).map((question) => question.id);

  const recorded = visible
    .filter((id) => id !== CONTACT)
    .reduce<Record<string, Answer | null>>(
      (acc, id) => ({ ...acc, [id]: answers[id] ?? null }),
      {},
    );

  return {
    ...recorded,
    estimatedMonthlyCost: estimateMonthlyFailureCost(answers),
    company: contact.company ?? null,
    phone: contact.phone?.trim() || null,
    notes: contact.notes?.trim() || null,
    outcome: getOutcomeId(outcome),
    summary: getSummary(answers),
    sourcePage,
  };
};
