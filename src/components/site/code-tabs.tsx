import { CodeBlock } from "@/components/site/code-block";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type CodeSample = { label: string; language: string; code: string };

/** Code samples in several languages, one tab each. Every tab is in the HTML. */
export function CodeTabs({ samples, after }: { samples: CodeSample[]; after?: React.ReactNode }) {
  return (
    <Tabs defaultValue={samples[0].label}>
      <TabsList>
        {samples.map((sample) => (
          <TabsTrigger key={sample.label} value={sample.label}>
            {sample.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {samples.map((sample) => (
        <TabsContent
          key={sample.label}
          value={sample.label}
          forceMount
          className="data-[state=inactive]:hidden"
        >
          <CodeBlock code={sample.code} language={sample.language} title={sample.label} />
          {after}
        </TabsContent>
      ))}
    </Tabs>
  );
}
