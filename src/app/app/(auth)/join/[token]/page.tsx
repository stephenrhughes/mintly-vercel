import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { appPath } from "@/lib/hosts";
import { siteConfig } from "@/lib/site";
import { createServiceClient, getServiceKey } from "@/lib/supabase/admin";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { type InviteDetails, lookupInvite } from "@/lib/team/operations";
import { inviteRolePhrase, joinErrorMessage } from "@/lib/team/rules";

import { AcceptForm } from "./accept-form";

export const metadata: Metadata = { title: "Join your team" };

const title = "Join your team";

export default function JoinPage(props: PageProps<"/app/join/[token]">) {
  return (
    <Suspense fallback={<AuthCard title={title}>{null}</AuthCard>}>
      <Join {...props} />
    </Suspense>
  );
}

function Problem({ heading, message }: { heading: string; message: string }) {
  return (
    <AuthCard
      title={heading}
      footer={
        <>
          Need help? Email{" "}
          <a
            href={`mailto:${siteConfig.supportEmail}`}
            className="font-medium text-primary hover:underline"
          >
            {siteConfig.supportEmail}
          </a>
        </>
      }
    >
      <p className="text-sm">{message}</p>
    </AuthCard>
  );
}

const invitedLine = (invite: InviteDetails) =>
  `${invite.inviterName ?? "Your colleague"} has invited you to join ${invite.orgName} on Mintly ${inviteRolePhrase(invite.role)}.`;

// The invite link (plan §6.6, JOIN-01 to JOIN-06).
async function Join({ params }: PageProps<"/app/join/[token]">) {
  const { token } = await params;
  const next = `/join/${encodeURIComponent(token)}`;

  if (!getSupabaseConfig() || !getServiceKey()) {
    return <Problem heading="Invite not found" message={joinErrorMessage("not_found")} />;
  }

  const invite = await lookupInvite({ db: createServiceClient() }, token);
  if (!invite) {
    return <Problem heading="Invite not found" message={joinErrorMessage("not_found")} />;
  }

  const user = await getCurrentUser();

  if (invite.problem) {
    if (invite.problem === "accepted" && user && invite.acceptedBy === user.id) {
      return (
        <AuthCard title="You're already in the team">
          <p className="text-sm">{joinErrorMessage("already_member")}</p>
          <Button asChild className="mt-6 w-full">
            <Link href={appPath("/tools")}>Go to Tools</Link>
          </Button>
        </AuthCard>
      );
    }
    return (
      <Problem
        heading="This invite can't be used"
        message={joinErrorMessage(invite.problem, { orgName: invite.orgName })}
      />
    );
  }

  if (!user) {
    const query = `?next=${encodeURIComponent(next)}&email=${encodeURIComponent(invite.email)}`;
    return (
      <AuthCard title={`Join ${invite.orgName}`} description={invitedLine(invite)}>
        <p className="text-sm">
          Create an account or sign in with <strong>{invite.email}</strong> to accept.
        </p>
        <div className="mt-6 grid gap-3">
          <Button asChild>
            <Link href={appPath(`/sign-up${query}`)}>Create an account</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={appPath(`/sign-in${query}`)}>I already have an account</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  if (user.hasMfa && user.aal !== "aal2") {
    redirect(appPath(`/sign-in/mfa?next=${encodeURIComponent(next)}`));
  }

  // JOIN-02: the invite is for one email address.
  if (user.email.toLowerCase() !== invite.email) {
    return (
      <AuthCard title={`Join ${invite.orgName}`} description={invitedLine(invite)}>
        <p className="text-sm">
          {joinErrorMessage("wrong_email", { invitedEmail: invite.email })} You&apos;re signed in as{" "}
          {user.email}.
        </p>
        <form action={appPath("/sign-out")} method="post" className="mt-6">
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="email" value={invite.email} />
          <Button type="submit" variant="outline" className="w-full">
            Sign out and use {invite.email}
          </Button>
        </form>
      </AuthCard>
    );
  }

  const membership = user.membership;
  if (membership?.orgId === invite.orgId) {
    return (
      <AuthCard title="You're already in the team">
        <p className="text-sm">{joinErrorMessage("already_member")}</p>
        <Button asChild className="mt-6 w-full">
          <Link href={appPath("/tools")}>Go to Tools</Link>
        </Button>
      </AuthCard>
    );
  }
  if (membership?.role === "owner") {
    return (
      <Problem
        heading={`You own ${membership.orgName}`}
        message={joinErrorMessage("owner_elsewhere")}
      />
    );
  }

  return (
    <AuthCard title={`Join ${invite.orgName}`} description={invitedLine(invite)}>
      <AcceptForm
        token={token}
        orgName={invite.orgName}
        currentOrgName={membership?.orgName ?? null}
      />
    </AuthCard>
  );
}
