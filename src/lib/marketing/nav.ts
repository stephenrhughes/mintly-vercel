// The sales site menu and footer columns, ported from mintly-web
// Navbars/DemoNavbar.js and Footers/SimpleFooter.js. Integration guides
// were only in the old signed-in menu; they are public now.

import { API_STATUS_URL } from "@/lib/marketing/contact";

export type NavLink = { href: string; label: string; description?: string; external?: boolean };
export type NavGroup = { label: string; sections: { heading?: string; links: NavLink[] }[] };
export type NavItem = NavLink | NavGroup;

export const isGroup = (item: NavItem): item is NavGroup => "sections" in item;

export const mainNav: NavItem[] = [
  {
    label: "Products",
    sections: [
      {
        links: [
          {
            href: "/features",
            label: "Bank Account Checker API & Web",
            description: "Sort code, account, IBAN and SWIFT checks by API or in the browser",
          },
          {
            href: "/eiscd",
            label: "EISCD Data File",
            description: "The UK's sort code directory, weekly or monthly",
          },
          {
            href: "/ai-agents",
            label: "AI Agents & MCP",
            description: "Give AI assistants real-time bank validation",
          },
        ],
      },
    ],
  },
  { href: "/pricing", label: "Pricing" },
  {
    label: "Resources",
    sections: [
      {
        heading: "Free tools",
        links: [
          { href: "/sort-code-checker", label: "Sort Code Checker" },
          { href: "/pricing-calculator", label: "Price Calculator" },
        ],
      },
      {
        heading: "Developers",
        links: [
          { href: "/get-started", label: "Getting started" },
          { href: "/docs", label: "Bank Account Checker API docs" },
          { href: "/eiscd-docs", label: "EISCD API docs" },
          { href: "/integration-guides", label: "Integration guides" },
          { href: "/release-notes", label: "Release notes" },
        ],
      },
      {
        heading: "Learn",
        links: [{ href: "/articles", label: "Articles" }],
      },
    ],
  },
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "About" },
];

export const footerColumns: { heading: string; links: NavLink[] }[] = [
  {
    heading: "Product",
    links: [
      { href: "/", label: "Home" },
      { href: "/features", label: "Bank Account Check Web Tools" },
      { href: "/bank-account-validation-api", label: "Bank Account Validation API" },
      { href: "/eiscd", label: "EISCD Data File" },
      { href: "/eiscd-api", label: "EISCD API" },
      { href: "/ai-agents", label: "AI Agents & MCP" },
      { href: "/pricing", label: "Pricing" },
      { href: "/pricing-comparison", label: "Pricing Comparison" },
      { href: "/pricing-calculator", label: "Price Calculator" },
      { href: "/sort-code-checker", label: "Free Tools" },
    ],
  },
  {
    heading: "Developers",
    links: [
      { href: "/docs", label: "API Documentation" },
      { href: "/eiscd-docs", label: "EISCD API Documentation" },
      { href: "/integration-guides", label: "Integration Guides" },
      { href: "/get-started", label: "Getting Started" },
      { href: "/release-notes", label: "Release Notes" },
      { href: API_STATUS_URL, label: "API Status", external: true },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/about", label: "About Us" },
      { href: "/faq", label: "FAQ & Support" },
      { href: "/articles", label: "Articles & Blog" },
      { href: "/terms", label: "Terms & Conditions" },
      { href: "/eiscd-terms", label: "EISCD Terms" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/modern-slavery", label: "Modern Slavery" },
    ],
  },
];
