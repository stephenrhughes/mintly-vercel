import type { Metadata } from "next";
import { Suspense } from "react";

import { dateTime } from "@/components/admin/shared";
import { DataTable, Td, Tr } from "@/components/admin/ui";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listFeedback } from "@/lib/admin/feedback";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Feedback" };

const title = "Feedback";

export default function FeedbackPage() {
  return (
    <Suspense fallback={<PageHeader title={title} />}>
      <Feedback />
    </Suspense>
  );
}

const answerText = (answers: Record<string, unknown>) =>
  Object.entries(answers)
    .filter(([, v]) => v !== null && v !== "" && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
    .join(" · ");

// Ratings and enquiries, read-only (plan §6.8). The public forms that send
// them arrive with the marketing site (phase 6).
async function Feedback() {
  await requireAdmin("/admin/feedback");
  const { ratings, enquiries } = await listFeedback();
  const average = ratings.length
    ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length
    : null;

  return (
    <div className="grid gap-8">
      <PageHeader title={title} description="Free-checker ratings and enquiries, newest first." />
      <Tabs defaultValue="enquiries">
        <TabsList>
          <TabsTrigger value="enquiries">Enquiries ({enquiries.length})</TabsTrigger>
          <TabsTrigger value="ratings">Ratings ({ratings.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="enquiries">
          <Card>
            <CardHeader>
              <CardTitle>Enquiries</CardTitle>
              <CardDescription>From the qualification questionnaire (LEAD-01).</CardDescription>
            </CardHeader>
            <CardContent>
              {enquiries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No enquiries yet.</p>
              ) : (
                <DataTable head={["Received", "From", "Outcome", "Answers"]}>
                  {enquiries.map((e) => (
                    <Tr key={e.id}>
                      <Td className="whitespace-nowrap">{dateTime(e.createdAt)}</Td>
                      <Td>
                        <span className="font-medium">{e.name}</span>
                        <div className="text-xs">
                          <a href={`mailto:${e.email}`} className="text-primary hover:underline">
                            {e.email}
                          </a>
                        </div>
                        {e.company || e.phone ? (
                          <div className="text-xs text-muted-foreground">
                            {[e.company, e.phone].filter(Boolean).join(", ")}
                          </div>
                        ) : null}
                      </Td>
                      <Td>
                        {e.outcome ?? "—"}
                        {e.sourcePage ? (
                          <div className="text-xs text-muted-foreground">{e.sourcePage}</div>
                        ) : null}
                      </Td>
                      <Td className="text-xs">
                        {answerText(e.answers) || "—"}
                        {e.message ? (
                          <p className="mt-1 whitespace-pre-line text-muted-foreground">
                            {e.message}
                          </p>
                        ) : null}
                      </Td>
                    </Tr>
                  ))}
                </DataTable>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="ratings">
          <Card>
            <CardHeader>
              <CardTitle>Ratings</CardTitle>
              <CardDescription>
                {average === null
                  ? "From the free checker (FREE-04)."
                  : `Average ${average.toFixed(1)} out of 5 over the latest ${ratings.length}.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ratings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No ratings yet.</p>
              ) : (
                <DataTable head={["Received", "Rating", "Feedback", "From"]}>
                  {ratings.map((r) => (
                    <Tr key={r.id}>
                      <Td className="whitespace-nowrap">{dateTime(r.createdAt)}</Td>
                      <Td className="tabular-nums">{r.rating} / 5</Td>
                      <Td>{r.feedback ?? <span className="text-muted-foreground">—</span>}</Td>
                      <Td className="text-xs text-muted-foreground">{r.source ?? "—"}</Td>
                    </Tr>
                  ))}
                </DataTable>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
