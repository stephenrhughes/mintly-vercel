import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/app/page-header";
import { SubmitButton } from "@/components/forms/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/session";
import { appPath } from "@/lib/hosts";
import { type ListedDomain, listDomains } from "@/lib/review/queries";

import { removeListedDomain } from "../actions";
import { dateTime } from "../shared";
import { DomainForm } from "./domain-form";

export const metadata: Metadata = { title: "Trusted and blocked domains" };

const title = "Trusted and blocked domains";

export default function DomainsPage() {
  return (
    <Suspense fallback={<PageHeader title={title} />}>
      <Domains />
    </Suspense>
  );
}

// plan §6.11: trial sign-ups from trusted domains are approved
// automatically; blocked domains can't sign up or check out.
async function Domains() {
  await requireAdmin("/admin/reviews/domains");
  const { trusted, blocked } = await listDomains();

  return (
    <div className="grid gap-8">
      <PageHeader
        title={title}
        action={
          <Link
            href={appPath("/admin/reviews")}
            className="text-sm font-medium text-primary hover:underline"
          >
            Back to the queue
          </Link>
        }
      />
      <DomainList
        list="trusted"
        heading="Trusted"
        description="New trials from these email domains are approved straight away."
        domains={trusted}
      />
      <DomainList
        list="blocked"
        heading="Blocked"
        description="Nobody can sign up or start a subscription with an email address on these domains."
        domains={blocked}
      />
    </div>
  );
}

function DomainList({
  list,
  heading,
  description,
  domains,
}: {
  list: "trusted" | "blocked";
  heading: string;
  description: string;
  domains: ListedDomain[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {heading} ({domains.length})
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        {domains.length > 0 ? (
          <ul className="divide-y text-sm">
            {domains.map((d) => (
              <li key={d.domain} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <span>
                  <span className="font-medium">{d.domain}</span>
                  <span className="block text-muted-foreground">
                    {d.reason ? `${d.reason}. ` : ""}Added {dateTime(d.addedAt)}
                    {d.addedBy ? ` by ${d.addedBy}` : ""}
                  </span>
                </span>
                <form action={removeListedDomain}>
                  <input type="hidden" name="list" value={list} />
                  <input type="hidden" name="domain" value={d.domain} />
                  <SubmitButton
                    size="sm"
                    variant="outline"
                    pendingLabel="Removing…"
                    aria-label={`Remove ${d.domain}`}
                  >
                    Remove
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
        <DomainForm list={list} />
      </CardContent>
    </Card>
  );
}
