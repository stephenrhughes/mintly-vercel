import { Bot, Lock, Plug, Terminal, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BookDemoButton } from "@/components/site/book-demo-button";
import { CheckList } from "@/components/site/check-list";
import { CodeTabs } from "@/components/site/code-tabs";
import { FaqList } from "@/components/site/faq-list";
import { FeatureGrid } from "@/components/site/feature-grid";
import { JsonLd } from "@/components/site/json-ld";
import { PageHero } from "@/components/site/page-hero";
import { Section, SectionHeading } from "@/components/site/section";
import { SkillDownload } from "@/components/site/skill-download";
import { Button } from "@/components/ui/button";
import { type FaqItem, faqJsonLd, fullJsonLd } from "@/lib/marketing/json-ld";
import { routeMetadata } from "@/lib/marketing/metadata";
import { pageInfo } from "@/lib/marketing/routes";

export const metadata: Metadata = routeMetadata("/ai-agents");

const link = (href: string, text: string) => (
  <Link href={href} className="text-primary underline underline-offset-2">
    {text}
  </Link>
);
const code = (text: string) => <code className="rounded bg-muted px-1 py-0.5 text-sm">{text}</code>;

const samples = [
  {
    label: "Claude Desktop config",
    language: "json",
    code: `{
  "mcpServers": {
    "mintlyBankAccountChecker": {
      "command": "uv",
      "args": [
        "--directory",
        "/path/to/mcp-mintly",
        "run",
        "main.py"
      ],
      "description": "Mintly Bank Account Checker"
    }
  }
}`,
  },
  {
    label: "Ask the agent",
    language: "javascript",
    code: `// Ask your AI agent things like:

"Is sort code 123456, account 12345678 valid, and
 which payment types does it support?"

"Can this account accept a Direct Debit Instruction?"

"Validate this list of 20 supplier bank accounts and
 flag any that fail modulus checking."`,
  },
  {
    label: "Agent Skill",
    language: "bash",
    code: `# Inside Claude Code, Cursor, Copilot, or any
# Agent Skills-compatible tool:
/mintly-api

# Then ask for what you need, e.g.
"Write a Node.js function to validate a UK sort code
 and handle 429 rate limit responses"`,
  },
];

const faq: FaqItem[] = [
  {
    question: "What is the Model Context Protocol (MCP)?",
    answer:
      '<p>MCP is an open standard for connecting AI systems to external tools and data sources. It lets an AI agent — such as Claude Desktop or a custom LLM application — call a defined set of functions ("tools") instead of guessing an answer. Mintly\'s MCP guide shows you how to run a local MCP server that exposes UK bank validation as a tool any MCP-compatible agent can call.</p>',
  },
  {
    question: "What's the difference between the MCP server and the Agent Skill?",
    answer:
      "<p>The MCP server is for runtime AI agents and chatbots — it gives an assistant like Claude Desktop a live tool to validate a sort code or account number during a conversation. The Agent Skill is for AI coding assistants — it gives tools like Claude Code, GitHub Copilot, or Cursor in-context knowledge of the Mintly API so they can write correct integration code for you while you build.</p>",
  },
  {
    question: "Which AI tools can connect to Mintly?",
    answer:
      "<p>The MCP server works with Claude Desktop and any MCP-compatible client. The Agent Skill works with Claude Code, VS Code with GitHub Copilot, Cursor, OpenAI Codex, and Gemini CLI — any client built on the open Agent Skills standard.</p>",
  },
  {
    question: "Is it safe to let an AI agent check bank account details?",
    answer:
      "<p>Yes, when set up correctly. Your Mintly API key stays in a local environment variable, never in a prompt or in source control. The MCP server acts as a proxy — the agent only ever sees the validation result, not your credentials — and Mintly does not persist the account numbers submitted for checking.</p>",
  },
  {
    question: "Do I need a paid Mintly plan to use the MCP server or Agent Skill?",
    answer:
      '<p>No. You can start with the free trial API key, so you can build and test against the sandbox and real API before upgrading. Paid plans raise your rate limits and request volume for production use. See <a href="/pricing">pricing</a> for details.</p>',
  },
];

export default function AiAgentsPage() {
  return (
    <>
      <JsonLd
        data={[
          fullJsonLd(pageInfo("/ai-agents", "AI Agent & MCP Bank Validation", "2026-07-06")),
          faqJsonLd("ai-agents#faq", faq),
        ]}
      />
      <PageHero
        title="Connect AI Agents to UK Bank Validation"
        lead={
          <p>
            Give Claude, chatbots, and coding agents a real tool for validating UK sort codes,
            account numbers, and IBANs — instead of letting them guess. Built on the open{" "}
            <a
              href="https://modelcontextprotocol.io/introduction"
              rel="noopener"
              className="underline"
            >
              Model Context Protocol
            </a>{" "}
            and the Agent Skills standard.
          </p>
        }
        actions={
          <>
            <Button
              asChild
              size="lg"
              className="bg-brand-mint text-brand-navy hover:bg-brand-mint/90"
            >
              <Link href="/integration-guides/mcp-server-python">Read the MCP guide</Link>
            </Button>
            <SkillDownload
              source="ai-agents-page"
              variant="outline"
              className="h-10 border-white/40 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white"
            />
          </>
        }
      >
        <ul className="mt-8 flex flex-wrap gap-2 text-sm">
          {["MCP server ready", "Downloadable Agent Skill", "<50ms response"].map((badge) => (
            <li key={badge} className="rounded-full bg-white/10 px-3 py-1">
              {badge}
            </li>
          ))}
        </ul>
      </PageHero>

      <Section>
        <SectionHeading align="center" title="Why AI Agents Need Real Bank Validation" />
        <FeatureGrid
          columns={2}
          features={[
            {
              icon: Bot,
              title: "LLMs can't validate bank details on their own",
              text: (
                <>
                  A sort code or IBAN either passes modulus checking against the official{" "}
                  {link("/eiscd", "EISCD")} dataset or it doesn&apos;t — a language model has no way
                  to know this from training data alone. Giving an agent a real tool call removes
                  the guesswork and the risk of a confidently wrong answer.
                </>
              ),
            },
            {
              icon: Zap,
              title: "Payment and onboarding copilots need it live",
              text: "Support chatbots, onboarding assistants, and internal ops copilots are increasingly the first thing that touches a customer's bank details. Wiring in real-time validation stops bad data reaching a payment run before a human ever reviews it.",
            },
            {
              icon: Terminal,
              title: "Coding agents can build the integration for you",
              text: "Rather than reading API docs yourself, an Agent Skills-compatible coding assistant can read Mintly's skill definition directly and generate a correct client, error handling, and sandbox tests in one pass.",
            },
            {
              icon: Lock,
              title: "Your credentials stay under your control",
              text: "Both integration paths keep your Mintly API key in a local environment variable. The agent only ever sees a validation result — never your key, and Mintly does not persist the account numbers you check.",
            },
          ]}
        />
      </Section>

      <Section tone="muted">
        <SectionHeading
          align="center"
          title="Two Ways to Connect"
          lead="Pick the integration that matches what you're building — a live agent that answers questions, or a coding assistant that writes the integration for you."
        />
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border bg-card p-6 shadow-xs">
            <Plug className="size-6 text-primary" aria-hidden />
            <h3 className="mt-4 text-xl font-semibold">MCP Server</h3>
            <p className="mt-3 text-muted-foreground">
              Run a lightweight local MCP server that exposes Mintly&apos;s bank validation as a
              tool. Connect it to Claude Desktop, Chat GPT, or any MCP-compatible AI agent, and ask
              questions in plain English.
            </p>
            <CheckList
              className="mt-4 text-sm"
              items={[
                "For runtime chatbots and AI assistants",
                "Works with Claude Desktop and any MCP client",
                "12-minute setup guide, Python + uv",
              ]}
            />
            <Button asChild className="mt-6">
              <Link href="/integration-guides/mcp-server-python">Read the MCP guide</Link>
            </Button>
          </div>
          <div className="rounded-xl border bg-card p-6 shadow-xs">
            <Terminal className="size-6 text-primary" aria-hidden />
            <h3 className="mt-4 text-xl font-semibold">Agent Skill</h3>
            <p className="mt-3 text-muted-foreground">
              Download the {code("mintly-api")} Agent Skill and drop it into your coding
              assistant&apos;s skills folder. Invoke {code("/mintly-api")} to generate client code,
              handle errors, and set up sandbox tests.
            </p>
            <CheckList
              className="mt-4 text-sm"
              items={[
                "For AI coding assistants, not runtime agents",
                "Claude Code, Copilot, Cursor, Codex, Gemini CLI",
                "Built on the open Agent Skills standard",
              ]}
            />
            <SkillDownload source="ai-agents-page" className="mt-6" />
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeading
          title="See It In Action"
          lead="A few lines of config connect an agent to live UK bank validation."
        />
        <div className="mt-8">
          <CodeTabs samples={samples} />
          <p className="text-muted-foreground">
            Full walkthrough, including the Python server code, is in the{" "}
            {link("/integration-guides/mcp-server-python", "MCP server guide")}.
          </p>
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading title="Where Teams Use This" />
        <FeatureGrid
          columns={2}
          features={[
            {
              title: "Payment onboarding chatbots",
              text: "An AI assistant collecting bank details during onboarding can validate them in the same conversation, catching typos before the customer moves on.",
            },
            {
              title: "Support agents verifying bank details",
              text: "Customer support copilots can confirm a sort code and account number are valid — and which payment schemes they support — without leaving the chat.",
            },
            {
              title: "Internal ops copilots",
              text: (
                <>
                  Ask an internal agent to validate a batch of supplier or payroll accounts before a
                  payment run, flagging anything that fails{" "}
                  {link("/articles/modulus-checking", "modulus checking")}.
                </>
              ),
            },
            {
              title: "Coding agents building your integration",
              text: (
                <>
                  Point Claude Code, Copilot, or Cursor at the {code("mintly-api")} skill and have
                  it write the client, tests, and error handling for your project.
                </>
              ),
            },
          ]}
        />
      </Section>

      <Section narrow>
        <SectionHeading title="Frequently Asked Questions" />
        <FaqList items={faq} />
      </Section>

      <section className="bg-brand-navy text-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">Give Your Agent a Real Tool</h2>
          <p className="mt-4 text-lg text-white/80">
            Free sandbox access, no credit card required. Set up the MCP server or download the
            Agent Skill in minutes.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="bg-brand-mint text-brand-navy hover:bg-brand-mint/90"
            >
              <Link href="/get-started">Start Free Trial</Link>
            </Button>
            <BookDemoButton size="lg" variant="onDark" />
          </div>
          <p className="mt-6 text-sm text-white/70">
            Prefer to talk it through first?{" "}
            <Link href="/about" className="underline">
              Contact us.
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
