import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { actionText, dateTime, StatusBadge } from "@/components/admin/shared";
import {
  Code,
  DataTable,
  ExternalAnchor,
  Field,
  SubscriptionBadge,
  Td,
  Tr,
} from "@/components/admin/ui";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isUuid } from "@/lib/admin/action";
import { compareFields } from "@/lib/admin/drift";
import { type DetailSubscription, getOrganisationDetail } from "@/lib/admin/organisations";
import { requireAdmin } from "@/lib/auth/session";
import { longDate } from "@/lib/billing/format";
import { appPath } from "@/lib/hosts";
import { roleLabels } from "@/lib/nav";
import { stripeDashboardUrl } from "@/lib/stripe/dashboard";
import { getOrgUsageForAdmin } from "@/lib/usage/queries";

import { UsageChart } from "../../../usage/usage-chart";
import { ResyncForm } from "./resync-form";

export const metadata: Metadata = { title: "Organisation" };

export default function OrganisationPage(props: PageProps<"/app/admin/organisations/[id]">) {
  return (
    <Suspense fallback={<PageHeader title="Organisation" />}>
      <Organisation {...props} />
    </Suspense>
  );
}

const productName = { bank_checker: "Bank Account Checker", eiscd: "EISCD" } as const;

// One organisation (ADM-03, ADM-04, ADM-07): the database next to Stripe,
// the team, the key, usage and the admin history.
async function Organisation({ params }: PageProps<"/app/admin/organisations/[id]">) {
  const { id } = await params;
  await requireAdmin(`/admin/organisations/${id}`);
  if (!isUuid(id)) notFound();
  const org = await getOrganisationDetail(id);
  if (!org) notFound();

  const products = [
    ...new Set(org.subscriptions.map((s) => s.stored?.product ?? s.stripe?.record.product)),
  ].filter((p): p is "bank_checker" | "eiscd" => Boolean(p));
  const usage = await Promise.all(
    (products.length ? products : (["bank_checker"] as const)).map(async (product) => ({
      product,
      usage: await getOrgUsageForAdmin(org.id, product).catch((error) => {
        console.error("reading usage failed", error);
        return null;
      }),
    })),
  );
  const used = org.seats.members + org.seats.pendingInvites;
  const overSeats = org.seats.limit !== null && used > org.seats.limit;
  const now = new Date().toISOString();

  return (
    <div className="grid gap-8">
      <PageHeader
        title={org.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={org.reviewStatus} /> Created {longDate(org.createdAt)}
          </span>
        }
        action={
          <Button asChild variant="outline">
            <Link href={appPath(`/admin/reviews/${org.id}`)}>Review and access</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Organisation</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            <Field label="ID">
              <Code>{org.id}</Code>
            </Field>
            <Field label="Stripe customer">
              {org.stripeCustomerId ? (
                <ExternalAnchor href={stripeDashboardUrl("customers", org.stripeCustomerId)}>
                  {org.stripeCustomerId}
                </ExternalAnchor>
              ) : (
                "None"
              )}
            </Field>
            <Field label="Review">
              {org.reviewedAt ? `Decided ${dateTime(org.reviewedAt)}` : "Not reviewed"}
              {org.reviewNote ? (
                <p className="mt-1 text-muted-foreground">{org.reviewNote}</p>
              ) : null}
            </Field>
            <Field label="Invites from other domains">
              {org.allowExternalInvites ? "Allowed" : "Only the owner's domain"}
            </Field>
          </dl>
        </CardContent>
      </Card>

      <section aria-labelledby="subscriptions" className="grid gap-4">
        <h2 id="subscriptions" className="text-lg font-semibold">
          Subscriptions
        </h2>
        {!org.stripeAvailable ? (
          <p className="text-sm text-muted-foreground">
            Stripe isn&apos;t available, so only the database side is shown.
          </p>
        ) : null}
        {org.subscriptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subscriptions.</p>
        ) : (
          org.subscriptions.map((sub) => (
            <SubscriptionCard
              key={sub.stored?.stripeSubscriptionId ?? sub.stripe?.record.stripeSubscriptionId}
              orgId={org.id}
              sub={sub}
            />
          ))
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
          <CardDescription className={overSeats ? "font-medium text-destructive" : undefined}>
            {used} of {org.seats.limit ?? "unknown"} seats used
            {org.seats.pendingInvites
              ? ` (${org.seats.pendingInvites} by ${org.seats.pendingInvites === 1 ? "an invite" : "invites"})`
              : ""}
            {overSeats ? ": over the limit" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          {org.members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members.</p>
          ) : (
            <DataTable head={["Person", "Role", "Joined"]}>
              {org.members.map((m) => (
                <Tr key={m.userId}>
                  <Td>
                    <span className="font-medium">{m.name ?? m.email}</span>
                    {m.name ? <div className="text-xs text-muted-foreground">{m.email}</div> : null}
                  </Td>
                  <Td>{roleLabels[m.role]}</Td>
                  <Td>{longDate(m.joinedAt)}</Td>
                </Tr>
              ))}
            </DataTable>
          )}
          {org.invites.length ? (
            <div className="grid gap-2">
              <h3 className="text-sm font-medium">Open invites</h3>
              <DataTable head={["Email", "Role", "Sent", "Expires"]}>
                {org.invites.map((i) => (
                  <Tr key={i.id}>
                    <Td>{i.email}</Td>
                    <Td className="capitalize">{i.role}</Td>
                    <Td>{i.sentAt ? dateTime(i.sentAt) : "Held for review"}</Td>
                    <Td>{i.expiresAt ? longDate(i.expiresAt) : "—"}</Td>
                  </Tr>
                ))}
              </DataTable>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API keys</CardTitle>
          <CardDescription>
            The key&apos;s state in the database and in API Gateway. The key value is never shown.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {org.keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No keys.</p>
          ) : (
            <DataTable head={["Key", "Database", "API Gateway", "Usage plans", "History"]}>
              {org.keys.map((k) => (
                <Tr key={k.id}>
                  <Td>
                    <Code>{k.id}</Code>
                    <div className="text-xs text-muted-foreground">{productName[k.product]}</div>
                  </Td>
                  <Td>
                    {k.enabled ? "Enabled" : "Disabled"}
                    {k.disabledByAdmin ? (
                      <div>
                        <Badge variant="destructive">Switched off by an admin</Badge>
                      </div>
                    ) : null}
                    {k.usagePlanId ? (
                      <div className="text-xs text-muted-foreground">
                        {org.usagePlanNames.get(k.usagePlanId) ?? k.usagePlanId}
                      </div>
                    ) : null}
                  </Td>
                  <Td>
                    {k.aws === null ? (
                      "Couldn't read"
                    ) : !k.aws.exists ? (
                      <span className="font-medium text-destructive">Deleted</span>
                    ) : k.aws.enabled ? (
                      "Enabled"
                    ) : (
                      "Disabled"
                    )}
                  </Td>
                  <Td>
                    {k.aws?.plans.length
                      ? k.aws.plans.map((p) => <div key={p}>{org.usagePlanNames.get(p) ?? p}</div>)
                      : "None"}
                  </Td>
                  <Td className="text-xs text-muted-foreground">
                    Created {longDate(k.createdAt)}
                    {k.rotatedFrom ? <div>Replaced {k.rotatedFrom}</div> : null}
                    {k.retireAt ? <div>Retires {dateTime(k.retireAt)}</div> : null}
                  </Td>
                </Tr>
              ))}
            </DataTable>
          )}
        </CardContent>
      </Card>

      {usage.map(({ product, usage: u }) => (
        <Card key={product}>
          <CardHeader>
            <CardTitle>Usage: {productName[product]}</CardTitle>
            {u?.lastSyncedAt ? (
              <CardDescription>Last synced {dateTime(u.lastSyncedAt)}</CardDescription>
            ) : null}
          </CardHeader>
          <CardContent>
            {u ? (
              <UsageChart points={u.points} now={now} />
            ) : (
              <p className="text-sm text-destructive">Usage couldn&apos;t be read.</p>
            )}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Admin history</CardTitle>
          <CardDescription>The latest 20 entries.</CardDescription>
        </CardHeader>
        <CardContent>
          {org.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {org.history.map((entry) => (
                <li key={entry.id}>
                  <span className="text-muted-foreground">{dateTime(entry.at)}:</span>{" "}
                  {actionText[entry.action] ?? entry.action}
                  <span className="text-muted-foreground">
                    {" "}
                    by {entry.actorEmail ?? "the system"}
                  </span>
                  {typeof entry.details.error === "string" ? (
                    <div className="text-xs text-destructive">{entry.details.error}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SubscriptionCard({ orgId, sub }: { orgId: string; sub: DetailSubscription }) {
  const id = sub.stored?.stripeSubscriptionId ?? sub.stripe?.record.stripeSubscriptionId ?? "";
  const product = sub.stored?.product ?? sub.stripe?.record.product ?? "bank_checker";
  const rows = compareFields(sub.stored, sub.stripe?.record ?? null);
  return (
    <Card className={sub.drift.length ? "border-destructive/50" : undefined}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {sub.stripe?.planName ?? productName[product]}
          {sub.current ? <Badge>Current</Badge> : null}
          {!sub.stored ? <Badge variant="outline">Only in Stripe</Badge> : null}
          {sub.stored && !sub.stripe ? <Badge variant="outline">Not found in Stripe</Badge> : null}
          {sub.drift.length ? (
            <Badge variant="destructive">
              {sub.drift.length} {sub.drift.length === 1 ? "difference" : "differences"}
            </Badge>
          ) : null}
        </CardTitle>
        <CardDescription>
          <ExternalAnchor href={stripeDashboardUrl("subscriptions", id)}>{id}</ExternalAnchor>
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <DataTable head={["Field", "Database", "Stripe says"]}>
          {rows.map((row) => (
            <tr
              key={row.field}
              className={
                row.differs ? "border-b bg-destructive/10 last:border-0" : "border-b last:border-0"
              }
            >
              <Td className={row.differs ? "font-medium" : undefined}>{row.label}</Td>
              <Td>
                {row.field === "status" ? (
                  <SubscriptionBadge status={row.stored} />
                ) : (
                  (row.stored ?? <span className="text-muted-foreground">empty</span>)
                )}
              </Td>
              <Td>
                {row.field === "status" ? (
                  <SubscriptionBadge status={row.expected} />
                ) : (
                  (row.expected ?? <span className="text-muted-foreground">empty</span>)
                )}
              </Td>
            </tr>
          ))}
        </DataTable>
        {sub.stored ? <ResyncForm orgId={orgId} subscriptionId={id} /> : null}
      </CardContent>
    </Card>
  );
}
