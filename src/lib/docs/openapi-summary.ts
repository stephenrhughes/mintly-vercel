// Reduces an OpenAPI document to what the server-rendered docs fallback
// shows (ported from mintly-web src/utils/openapiSummary.js). It runs at
// build time on our own checked-in specs, never on user input. Anchors use
// ReDoc's own slug rules so links keep working once ReDoc has loaded.

import { marked } from "marked";

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"] as const;

export function slugify(value: string): string {
  return String(value)
    .trim()
    .replace(/\s+/g, "-")
    .replace(/&/g, "-and-")
    .replace(/[^\p{L}\p{N}\p{M}-]+/gu, "")
    .replace(/-{2,}/g, "-");
}

function operationAnchor(tag: string, operationId: string): string {
  if (!operationId) return tag ? `#tag/${slugify(tag)}` : "";
  return tag ? `#tag/${slugify(tag)}/operation/${operationId}` : `#operation/${operationId}`;
}

function firstSentence(text?: string): string {
  if (!text) return "";
  const flat = text.replace(/\s+/g, " ").trim();
  const end = flat.search(/\.\s|\.$/);
  return end === -1 ? flat : flat.slice(0, end + 1);
}

const FENCE = /^\s{0,3}(?:```|~~~)/;
const TOP_LEVEL_HEADING = /^#{1,2}\s+(.*\S)\s*$/;

/** Splits info.description as ReDoc does: each top-level heading is its own section. */
function splitDescription(markdown: string) {
  const lead: string[] = [];
  const sections: { title: string; body: string[] }[] = [];
  let current: { title: string; body: string[] } | null = null;
  let inFence = false;
  for (const line of markdown.split("\n")) {
    if (FENCE.test(line)) inFence = !inFence;
    const heading = inFence ? null : TOP_LEVEL_HEADING.exec(line);
    if (heading) {
      current = { title: heading[1], body: [] };
      sections.push(current);
      continue;
    }
    (current ? current.body : lead).push(line);
  }
  return {
    lead: lead.join("\n").trim(),
    sections: sections.map(({ title, body }) => ({
      id: `section/${slugify(title)}`,
      title,
      html: marked.parse(body.join("\n").trim(), { async: false }),
    })),
  };
}

export type SpecSummary = ReturnType<typeof summariseSpec>;

type OpenApi = {
  info?: { title?: string; version?: string; description?: string };
  servers?: { url: string; description?: string }[];
  paths?: Record<string, Record<string, { tags?: string[]; operationId?: string; summary?: string; description?: string }>>;
};

export function summariseSpec(spec: OpenApi) {
  const { info = {}, servers = [], paths = {} } = spec;
  const operations = Object.entries(paths).flatMap(([path, item]) =>
    HTTP_METHODS.filter((method) => item[method]).map((method) => {
      const op = item[method];
      const tag = op.tags?.[0] ?? "";
      return {
        method: method.toUpperCase(),
        path,
        tag,
        summary: op.summary ?? "",
        blurb: firstSentence(op.description),
        anchor: operationAnchor(tag, op.operationId ?? ""),
      };
    }),
  );
  const { lead, sections } = splitDescription(info.description ?? "");
  return {
    title: info.title ?? "",
    version: info.version ?? "",
    descriptionHtml: lead ? marked.parse(lead, { async: false }) : "",
    sections,
    servers: servers.map(({ url, description = "" }) => ({ url, description })),
    operations,
  };
}
