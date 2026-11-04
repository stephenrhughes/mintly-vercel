import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { appPath, safeNextPath } from "@/lib/hosts";

import { MfaForm } from "./mfa-form";

export const metadata: Metadata = { title: "Two-step verification" };

const title = "Two-step verification";
const description = "Enter the 6-digit code from your authenticator app.";

// SEC-01: the second sign-in step for users with an authenticator app.
async function Mfa({ searchParams }: PageProps<"/app/sign-in/mfa">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  return (
    <AuthCard
      title={title}
      description={description}
      footer={
        <form action={appPath("/sign-out")} method="post" className="inline">
          Not you?{" "}
          <button type="submit" className="font-medium text-primary hover:underline">
            Sign out
          </button>
        </form>
      }
    >
      <MfaForm next={next} />
    </AuthCard>
  );
}

export default function MfaPage(props: PageProps<"/app/sign-in/mfa">) {
  return (
    <Suspense
      fallback={
        <AuthCard title={title} description={description}>
          {null}
        </AuthCard>
      }
    >
      <Mfa {...props} />
    </Suspense>
  );
}
