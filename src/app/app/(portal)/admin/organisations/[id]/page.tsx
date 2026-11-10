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
import { priceChoices } from "@/lib/admin/subscription-changes-server";
import { isLiveStatus } from "@/lib/billing/subscription-record";

import { UsageChart } from "../../../usage/usage-chart";
import {
  AccessForms,
  CancelForm,
  ExtendTrialForm,
  ExternalInvitesForm,
  ExtraSeatsForm,
  InviteForm,
  InviteRowForms,
  KeyForms,
  MemberForms,
  PlanChangeForm,
  type PriceChoice,
  TransferForm,
} from "./admin-forms";
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
  // Prices an admin can move a live subscription to (PLAN-09).
  const liveProducts = [
    ...new Set(
      org.subscriptions
        .filter((s) => s.stored && s.stripe && isLiveStatus(s.stripe.record.status))
        .map((s) => s.stored!.product),
    ),
  ];
  const prices = new Map<string, PriceChoice[]>(
    await Promise.all(
      liveProducts.map(async (product) => {
        const choices = await priceChoices(product).catch((error) => {
          console.error("listing prices failed", error);
          return [];
        });
        return [
          product,
          choices.map((p) => ({
            id: p.id,
            name: p.name,
            active: p.active,
            unitAmount: p.unitAmount,
            currency: p.currency,
            interval: p.recurring
              ? `${p.recurring.count > 1 ? `${p.recurring.count} ` : ""}${p.recurring.interval}`
              : null,
            custom: false,
          })),
        ] as const;
      }),
    ),
  );
  const liveKeyIds = new Set(
    org.subscriptions
      .filter((s) => s.stored && !s.stored.expired)
      .map((s) => s.stored!.apiKeyId)
      .filter(Boolean),
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
              <ExternalInvitesForm orgId={org.id} allowed={org.allowExternalInvites} />
            </Field>
            {org.reviewStatus === "approved" || org.reviewStatus === "suspended" ? (
              <Field label="Access">
                <AccessForms orgId={org.id} status={org.reviewStatus} />
              </Field>
            ) : null}
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
              stripeAvailable={org.stripeAvailable}
              prices={prices.get(sub.stored?.product ?? "bank_checker") ?? []}
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
            <DataTable head={["Person", "Role", "Joined", ""]}>
              {org.members.map((m) => (
                <Tr key={m.userId}>
                  <Td>
                    <span className="font-medium">{m.name ?? m.email}</span>
                    {m.name ? <div className="text-xs text-muted-foreground">{m.email}</div> : null}
                  </Td>
                  <Td>{roleLabels[m.role]}</Td>
                  <Td>{longDate(m.joinedAt)}</Td>
                  <Td>
                    {m.role === "owner" ? null : (
                      <MemberForms orgId={org.id} userId={m.userId} role={m.role} />
                    )}
                  </Td>
                </Tr>
              ))}
            </DataTable>
          )}
          {org.invites.length ? (
            <div className="grid gap-2">
              <h3 className="text-sm font-medium">Open invites</h3>
              <DataTable head={["Email", "Role", "Sent", "Expires", ""]}>
                {org.invites.map((i) => (
                  <Tr key={i.id}>
                    <Td>{i.email}</Td>
                    <Td className="capitalize">{i.role}</Td>
                    <Td>{i.sentAt ? dateTime(i.sentAt) : "Held for review"}</Td>
                    <Td>{i.expiresAt ? longDate(i.expiresAt) : "—"}</Td>
                    <Td>
                      <InviteRowForms orgId={org.id} inviteId={i.id} />
                    </Td>
                  </Tr>
                ))}
              </DataTable>
            </div>
          ) : null}
          <div className="grid gap-6 border-t pt-6">
            <InviteForm orgId={org.id} />
            <TransferForm
              orgId={org.id}
              candidates={org.members
                .filter((m) => m.role !== "owner")
                .map((m) => ({
                  userId: m.userId,
                  label: `${m.name ?? m.email} (${roleLabels[m.role]})`,
                }))}
            />
          </div>
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
            <DataTable head={["Key", "Database", "API Gateway", "Usage plans", "History", ""]}>
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
                  <Td className="min-w-64">
                    {k.retireAt ? null : (
                      <KeyForms
                        orgId={org.id}
                        keyId={k.id}
                        disabledByAdmin={k.disabledByAdmin}
                        canRotate={
                          k.product === "bank_checker" && k.enabled && liveKeyIds.has(k.id)
                        }
                      />
                    )}
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

function SubscriptionCard({
  orgId,
  sub,
  prices,
  stripeAvailable,
}: {
  orgId: string;
  sub: DetailSubscription;
  prices: PriceChoice[];
  stripeAvailable: boolean;
}) {
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
          {sub.stored && !sub.stripe && stripeAvailable ? (
            <Badge variant="destructive">Not found in Stripe</Badge>
          ) : null}
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
                <FieldValue present={Boolean(sub.stored)} field={row.field} value={row.stored} />
              </Td>
              <Td>
                <FieldValue present={Boolean(sub.stripe)} field={row.field} value={row.expected} />
              </Td>
            </tr>
          ))}
        </DataTable>
        {sub.stored ? <ResyncForm orgId={orgId} subscriptionId={id} /> : null}
        {sub.stored && sub.stripe && isLiveStatus(sub.stripe.record.status) ? (
          <details className="rounded-md border p-4">
            <summary className="cursor-pointer text-sm font-medium">
              Change this subscription
            </summary>
            <div className="mt-4 grid gap-4">
              <PlanChangeForm
                orgId={orgId}
                subscriptionId={id}
                prices={prices}
                currentPriceId={sub.stripe.record.stripePriceId}
                trialing={sub.stripe.record.trialing}
              />
              <ExtraSeatsForm
                orgId={orgId}
                subscriptionId={id}
                extraUsers={sub.stripe.record.extraUsers}
              />
              {sub.stripe.record.trialing ? (
                <ExtendTrialForm orgId={orgId} subscriptionId={id} />
              ) : null}
              <CancelForm
                orgId={orgId}
                subscriptionId={id}
                cancelling={Boolean(sub.stripe.record.cancelAt)}
              />
            </div>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** One side of the database-and-Stripe comparison; a dash when that side has no record. */
function FieldValue({
  present,
  field,
  value,
}: {
  present: boolean;
  field: string;
  value: string | null;
}) {
  if (!present) return <span className="text-muted-foreground">—</span>;
  if (field === "status") return <SubscriptionBadge status={value} />;
  return value ?? <span className="text-muted-foreground">empty</span>;
}
