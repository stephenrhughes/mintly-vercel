import type { SpecSummary } from "@/lib/docs/openapi-summary";

// The server-rendered reference: the page until ReDoc mounts, and the whole
// page for crawlers and anyone without JavaScript. Built from the spec itself.
const METHOD_COLOURS: Record<string, string> = {
  GET: "bg-emerald-100 text-emerald-900",
  POST: "bg-sky-100 text-sky-900",
  PUT: "bg-amber-100 text-amber-900",
  DELETE: "bg-red-100 text-red-900",
};

export function RedocFallback({
  summary,
  specUrl,
  specJsonUrl,
}: {
  summary: SpecSummary;
  specUrl: string;
  specJsonUrl: string;
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">
        {summary.title} {summary.version && <span className="text-muted-foreground">({summary.version})</span>}
      </h1>
      <p className="mt-3 text-sm">
        Download OpenAPI specification:{" "}
        <a download href={specUrl} className="text-primary underline">
          YAML
        </a>{" "}
        <a download href={specJsonUrl} className="text-primary underline">
          JSON
        </a>
      </p>
      {summary.descriptionHtml && (
        <div className="prose mt-6 max-w-none prose-a:text-primary" dangerouslySetInnerHTML={{ __html: summary.descriptionHtml }} />
      )}
      {summary.servers.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">Servers</h2>
          <ul className="mt-3 space-y-1 font-mono text-sm">
            {summary.servers.map((server) => (
              <li key={server.url}>
                {server.url}
                {server.description && <span className="ml-2 font-sans text-muted-foreground">{server.description}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Endpoints</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th scope="col" className="p-3">Method</th>
                <th scope="col" className="p-3">Path</th>
                <th scope="col" className="p-3">What it does</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {summary.operations.map((op) => (
                <tr key={`${op.method} ${op.path}`}>
                  <td className="p-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${METHOD_COLOURS[op.method] ?? "bg-muted"}`}>
                      {op.method}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-xs">
                    <a href={op.anchor} className="hover:underline">
                      {op.path}
                    </a>
                  </td>
                  <td className="p-3">
                    <span className="font-medium">{op.summary}</span>
                    {op.blurb && <span className="block text-muted-foreground">{op.blurb}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {summary.sections.map((section) => (
        <section key={section.id} id={section.id} className="mt-10 scroll-mt-20">
          <h2 className="text-xl font-semibold">{section.title}</h2>
          <div className="prose mt-3 max-w-none prose-a:text-primary" dangerouslySetInnerHTML={{ __html: section.html }} />
        </section>
      ))}
    </div>
  );
}
