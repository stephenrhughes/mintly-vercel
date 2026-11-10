"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

// "How to do this with the API" (TOOL-07, TOOL-13). Every sample uses a
// placeholder: the key itself never reaches the browser on this page
// (plan §6.2). Owners and developers copy it from the subscription page.

export const KEY_PLACEHOLDER = "YOUR_API_KEY";

export function sampleCode(baseUrl: string, path: string) {
  const url = `${baseUrl}${path}`;
  return [
    {
      id: "curl",
      label: "curl",
      code: `curl --request GET '${url}' \\\n  --header 'x-api-key: ${KEY_PLACEHOLDER}'`,
    },
    {
      id: "node",
      label: "Node.js",
      code: `const response = await fetch("${url}", {
  headers: { "x-api-key": process.env.MINTLY_API_KEY },
});
if (response.status === 404) {
  // Not a valid account
}
const result = await response.json();
console.log(result);`,
    },
    {
      id: "python",
      label: "Python",
      code: `import os
import requests

response = requests.get(
    "${url}",
    headers={"x-api-key": os.environ["MINTLY_API_KEY"]},
    timeout=10,
)
if response.status_code == 404:
    pass  # Not a valid account
print(response.json())`,
    },
    {
      id: "csharp",
      label: "C#",
      code: `using var client = new HttpClient();
var request = new HttpRequestMessage(HttpMethod.Get, "${url}");
request.Headers.Add("x-api-key", Environment.GetEnvironmentVariable("MINTLY_API_KEY"));
var response = await client.SendAsync(request);
Console.WriteLine(await response.Content.ReadAsStringAsync());`,
    },
  ];
}

export function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre
        className="overflow-x-auto rounded-md border bg-muted p-4 pr-24 font-mono text-xs leading-relaxed"
        aria-label={label}
      >
        <code>{code}</code>
      </pre>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="absolute top-2 right-2"
        onClick={() =>
          void navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          })
        }
      >
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
