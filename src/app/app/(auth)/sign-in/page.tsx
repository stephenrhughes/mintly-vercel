import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { recaptchaSiteKey } from "@/lib/captcha";
import { appPath, safeNextPath } from "@/lib/hosts";

import { SignInForm } from "./sign-in-form";
import { SsoForm } from "./sso-form";

export const metadata: Metadata = { title: "Sign in" };

const linkErrors: Record<string, string> = {
  link: "That link has expired or was opened in a different browser. Sign in, or ask for a new link.",
};

// SSO-03: a domain with no SSO tenant drops back to password sign-in.
const noSsoMessage =
  "Your organisation doesn't sign in to Mintly with SSO. Sign in with your password instead.";

async function SignIn({ searchParams }: PageProps<"/app/sign-in">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  const error =
    typeof params.error === "string"
      ? linkErrors[params.error]
      : params.sso === "none"
        ? noSsoMessage
        : undefined;
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
      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <SsoForm next={next} siteKey={recaptchaSiteKey()} />
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
