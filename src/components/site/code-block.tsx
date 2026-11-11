import { codeToHtml } from "shiki";

import { CopyButton } from "@/components/site/copy-button";

// A highlighted code sample, rendered to HTML when the page is prerendered
// (shiki), so no highlighter ships to the browser. Replaces the old
// Prism-in-the-browser Code component.
// Cached, so highlighting happens once at build time (shiki reads the clock,
// which a prerender otherwise refuses).
async function highlight(code: string, language: string) {
  "use cache";
  return codeToHtml(code, { lang: language, theme: "github-dark-dimmed" });
}

export async function CodeBlock({
  code,
  language = "bash",
  title,
}: {
  code: string;
  language?: string;
  title?: string;
}) {
  const html = await highlight(code.trim(), language);
  return (
    <figure className="not-prose relative my-6 overflow-hidden rounded-xl bg-[#22272e] ring-1 ring-white/10">
      <figcaption className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs text-white/60">
        <span>{title ?? language}</span>
        <CopyButton text={code.trim()} />
      </figcaption>
      <div
        className="overflow-x-auto p-4 text-sm leading-relaxed [&_pre]:!bg-transparent"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </figure>
  );
}
