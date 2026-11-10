import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { appPath, safeNextPath } from "@/lib/hosts";

import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

const linkErrors: Record<string, string> = {
  link: "That link has expired or was opened in a different browser. Sign in, or ask for a new link.",
};

async function SignIn({ searchParams }: PageProps<"/app/sign-in">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  const error = typeof params.error === "string" ? linkErrors[params.error] : undefined;
  const nextQuery = next === "/" ? "" : `?next=${encodeURIComponent(next)}`;
  // Pre-filled from an invite (JOIN-01) or the SSO lookup (SSO-03).
  const email = typeof params.email === "string" ? params.email.slice(0, 254) : undefined;

  return (
    <AuthCard
      title="Sign in to Mintly"
      footer={
        <>
          New to Mintly?{" "}
          <Link
            href={appPath(`/sign-up${nextQuery}`)}
            className="font-medium text-primary hover:underline"
          >
            Start a free trial
          </Link>
        </>
      }
    >
      <SignInForm
        next={next}
        linkError={error}
        defaultEmail={email}
        forgotHref={appPath("/forgot-password")}
      />
    </AuthCard>
  );
}

export default function SignInPage(props: PageProps<"/app/sign-in">) {
  return (
    <Suspense fallback={<AuthCard title="Sign in to Mintly">{null}</AuthCard>}>
      <SignIn {...props} />
    </Suspense>
  );
}
