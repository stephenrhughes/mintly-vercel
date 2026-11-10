import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { appPath } from "@/lib/hosts";

// Old invite links, /join?invite=<id> (plan §8). The migration (plan §10.1)
// stores the old invite's hash, so these keep working until they expire.
export default function LegacyJoinPage(props: PageProps<"/app/join">) {
  return (
    <Suspense fallback={<AuthCard title="Join your team">{null}</AuthCard>}>
      <LegacyJoin {...props} />
    </Suspense>
  );
}

async function LegacyJoin({ searchParams }: PageProps<"/app/join">) {
  const { invite } = await searchParams;
  const token = typeof invite === "string" ? invite.trim() : "";
  redirect(appPath(token ? `/join/${encodeURIComponent(token)}` : "/join/missing"));
  return null;
}
