import { CircleAlert, CircleCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePortalViewer } from "@/lib/auth/session";
import { longDate } from "@/lib/billing/format";
import { appPath } from "@/lib/hosts";
import { roleLabels } from "@/lib/nav";
import { siteConfig } from "@/lib/site";
import { getTeam } from "@/lib/team/queries";
import { canManageTeam, emailDomain, inviteExpiryLabel } from "@/lib/team/rules";

import { InviteActions, InviteForm, MemberActions } from "./team-forms";

export const metadata: Metadata = { title: "Team" };

const title = "Team";

export default function TeamPage(props: PageProps<"/app/team">) {
  return (
    <Suspense fallback={<PageHeader title={title} />}>
      <Team {...props} />
    </Suspense>
  );
}

// Confirmations for changes that remove the row they were made from.
const doneText: Record<string, string> = {
  withdrawn: "The invite has been withdrawn. Its link no longer works.",
  removed: "They've been removed from the team. They keep their login but lose access.",
  "removed-developer":
    "They've been removed from the team. Developers can see the API key: if they may have kept a copy, rotate the key from the Subscription page.",
};

// TEAM-02, TEAM-03: everyone sees the team and the seats; only the owner
// changes it (plan §3, §6.6).
async function Team({ searchParams }: PageProps<"/app/team">) {
  const [user, params] = await Promise.all([requirePortalViewer("/team"), searchParams]);
  const done = typeof params.done === "string" ? doneText[params.done] : undefined;
  const membership = user.membership;

  if (!membership) {
    return (
      <div className="grid gap-8">
        <PageHeader title={title} description="Share your subscription with colleagues." />
        <Card>
          <CardHeader>
            <CardTitle>Choose a plan first</CardTitle>
            <CardDescription>
              Your team shares one subscription. Start a free trial, then invite colleagues here. If
              a colleague has already subscribed, ask them to invite you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={appPath("/subscribe")}>Choose a plan</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isOwner = canManageTeam(membership.role);
  const team = await getTeam(membership.orgId, { withInvites: isOwner });
  const { limit, members, pendingInvites } = team.seats;
  const used = members + pendingInvites;
  const full = limit !== null && used >= limit;
  const over = limit !== null && used > limit;
  const now = new Date();
  const canInvite =
    membership.reviewStatus === "approved" || membership.reviewStatus === "pending_review";

  return (
    <div className="grid gap-8">
      <PageHeader
        title={title}
        description={`The people who share ${membership.orgName}'s subscription.`}
        action={
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4" aria-hidden />
            {limit === null ? `${used} seats used` : `${used} of ${limit} seats used`}
          </p>
        }
      />

      {done ? (
        <Alert variant="success">
          <CircleCheck aria-hidden />
          <AlertDescription className="text-secondary-foreground">
            <p>
              {done}
              {params.done === "removed-developer" ? (
                <>
                  {" "}
                  <Link href={appPath("/subscription#api-key")} className="font-medium underline">
                    Go to Subscription
                  </Link>
                </>
              ) : null}
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      {isOwner && full ? (
        <Alert>
          <CircleAlert aria-hidden />
          <AlertTitle>{over ? "Your team is over its seat limit" : "Your team is full"}</AlertTitle>
          <AlertDescription>
            <p>
              Every person and every open invite takes a seat, you included. Remove someone or
              withdraw an invite, move to a plan with more seats, or contact us about extra seats.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href={appPath("/subscription/change")}>Upgrade</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <a href={`mailto:${siteConfig.supportEmail}?subject=Extra%20seats`}>Contact us</a>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {isOwner && canInvite ? (
        <Card>
          <CardHeader>
            <CardTitle>Invite a colleague</CardTitle>
            <CardDescription>
              {membership.reviewStatus === "pending_review"
                ? "We'll send invites as soon as your account is approved. Invites last 14 days."
                : "We'll email them a link to join. Invites last 14 days."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InviteForm domain={emailDomain(user.email)} full={full} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          {isOwner ? null : (
            <CardDescription>
              Only the account owner can invite or remove people, or change roles.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {team.members.map((member) => {
              const label = member.name ?? member.email;
              return (
                <li
                  key={member.userId}
                  className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      <span className="truncate">{label}</span>
                      <Badge variant={member.role === "owner" ? "default" : "outline"}>
                        {roleLabels[member.role]}
                      </Badge>
                      {member.userId === user.id ? (
                        <span className="text-xs text-muted-foreground">(you)</span>
                      ) : null}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {member.name ? `${member.email} · ` : ""}Joined {longDate(member.joinedAt)}
                    </p>
                  </div>
                  {isOwner && member.role !== "owner" && member.userId !== user.id ? (
                    <MemberActions userId={member.userId} name={label} role={member.role} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {isOwner && team.invites.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Invites</CardTitle>
            <CardDescription>Open invites hold a seat until they expire.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {team.invites.map((inv) => (
                <li
                  key={inv.id}
                  className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      <span className="truncate">{inv.email}</span>
                      <Badge variant="outline">Invited · {roleLabels[inv.role]}</Badge>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {inviteExpiryLabel(inv.expiresAt, now)}
                    </p>
                  </div>
                  <InviteActions inviteId={inv.id} email={inv.email} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
