// The article cards on /articles (ported from mintly-web pages/articles.js).
// The articles themselves are MDX files in src/content/articles/.

export const ARTICLE_TAGS = [
  "concepts",
  "api",
  "automation",
  "auddis",
  "eiscd",
  "compliance",
  "international",
  "tools",
] as const;
export type ArticleTag = (typeof ARTICLE_TAGS)[number];

export type ArticleCard = { title: string; description: string; href: string; tags: ArticleTag[] };

export const ARTICLE_CARDS: ArticleCard[] = [
  {
    title: "High-Volume Bank Account Validation API",
    description:
      "Need to check 50,000+ UK bank accounts a month? Learn how to validate sort codes and account numbers at scale via API, with code examples and volume pricing.",
    href: "/articles/high-volume-bank-account-validation-api",
    tags: ["api", "automation"],
  },
  {
    title: "The importance of checking bank account details",
    description:
      "One mistyped digit can send money to a stranger's account - and your bank has done nothing wrong. What validation catches, and what it doesn't.",
    href: "/articles/reasons",
    tags: ["concepts"],
  },
  {
    title: "What is Modulus Checking?",
    description:
      "The arithmetic UK banks build into account numbers, the three algorithms behind it, and the response case that trips up new integrations.",
    href: "/articles/modulus-checking",
    tags: ["concepts"],
  },
  {
    title: "Our Guide to Automated Bank Account Checking",
    description:
      "Where to put a validation check in your workflow, what an API call actually looks like, and how to work out whether automating is worth it.",
    href: "/articles/automation",
    tags: ["automation", "api"],
  },
  {
    title: "EISCD Data File: The UK Sort Code Directory Explained",
    description:
      "What is actually in the UK sort code directory, including the future-dated changes and redirection data most teams do not realise they have.",
    href: "/articles/eiscd-data-file",
    tags: ["eiscd"],
  },
  {
    title: "Checking sort code and bank account numbers",
    description:
      "A short introduction about sort codes, modulus checking and what you need to think about when automating it.",
    href: "/sort-code-checker",
    tags: ["tools"],
  },
  {
    title: "SWIFT codes and IBANs explained",
    description:
      "How BIC and IBAN are structured, how the MOD-97 check digits work, and why most validators miss the national check digits underneath.",
    href: "/articles/swift-iban",
    tags: ["international", "concepts"],
  },
  {
    title: "How Mintly can help with pre-AUDDIS checks",
    description:
      "Validate bank details before AUDDIS submission to cut Direct Debit rejections. Learn how pre-AUDDIS checks keep your Bacs setups clean.",
    href: "/articles/auddis",
    tags: ["auddis", "automation"],
  },
  {
    title: "Sort codes: What you need to know",
    description:
      "What the six digits mean, why guessing the bank from the first two is unreliable, and what a sort code check tells you beyond existence.",
    href: "/articles/sortcodes",
    tags: ["concepts"],
  },
  {
    title: "BACS and Direct Debits: What you need to know",
    description:
      "The three-day Bacs cycle, the Direct Debit Guarantee, and what the ARUDD, ADDACS and AWACS reports are actually telling you.",
    href: "/articles/bacs-and-direct-debit",
    tags: ["concepts"],
  },
  {
    title: "Bank Validation APIs",
    description:
      "APIs let your systems validate bank details in real time. Learn how bank validation APIs work and what to look for in a provider.",
    href: "/articles/bank-validation-api",
    tags: ["automation", "api"],
  },
  {
    title: "GDPR and Compliance",
    description:
      "Bank details are not special category data. What UK GDPR actually requires when you hold them, and what to ask a validation provider.",
    href: "/articles/gdpr-and-security",
    tags: ["compliance"],
  },
];

export const GUIDE_CARDS: { title: string; description: string; href: string }[] = [
  {
    title: "Node.js",
    description: "Integrate Mintly with your Node.js application",
    href: "/integration-guides/nodejs-integration",
  },
  {
    title: "Python",
    description: "Integrate Mintly with your Python application",
    href: "/integration-guides/python-integration",
  },
  {
    title: "C#",
    description: "Integrate Mintly with your C# .NET application",
    href: "/integration-guides/csharp-integration",
  },
  {
    title: "MCP Server",
    description: "Build a Model Context Protocol server to connect AI to Mintly",
    href: "/integration-guides/mcp-server-python",
  },
  {
    title: "AI Agents",
    description: "Connect Claude, chatbots and coding agents to Mintly via MCP and Agent Skills",
    href: "/ai-agents",
  },
  {
    title: "Zapier",
    description: "Integrate Mintly with your Zapier workflow",
    href: "/integration-guides/zapier-integration",
  },
  {
    title: "Power Automate",
    description: "Integrate Mintly with your Power Automate workflow",
    href: "/integration-guides/power-automate-integration",
  },
  {
    title: "Salesforce",
    description: "Integrate Mintly with Salesforce",
    href: "/integration-guides/salesforce-integration",
  },
  {
    title: "Claude Code",
    description: "Use our Claude Code skill to help your AI coding agent connect with our API",
    href: "/docs#section/AI-agent-skill",
  },
  {
    title: "Other",
    description: "Use our API documentation to integrate Mintly with any other system",
    href: "/docs",
  },
];

/** What each MDX file exports alongside its content. */
export type ContentMeta = {
  heading: string;
  readTime?: string;
  published?: string;
  modified?: string;
  related?: { title: string; href: string }[];
  faq?: { question: string; answer: string }[];
};
