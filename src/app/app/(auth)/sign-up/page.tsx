import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { intentFromNext } from "@/lib/billing/plan-intent";
import { PLANS } from "@/lib/billing/plans";
import { appPath, safeNextPath } from "@/lib/hosts";
import { legalDocuments } from "@/lib/legal";

import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Start your free trial" };

const title = "Create your Mintly account";
const description = "Start a 14-day free trial. No card needed.";

async function SignUp({ searchParams }: PageProps<"/app/sign-up">) {
  const params = await searchParams;
  // Plan intent from the pricing page survives sign-up (BUY-02, APP-05).
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  const nextQuery = next === "/" ? "" : `?next=${encodeURIComponent(next)}`;
  const intent = intentFromNext(next);
  // Joining a team rather than starting a trial (JOIN-01).
  const joining = next.startsWith("/join/");
  const email = typeof params.email === "string" ? params.email.slice(0, 254) : undefined;

  return (
    <AuthCard
      title={title}
      description={
        joining
          ? "Create an account to join your team. Use the email address the invite was sent to."
          : intent
            ? `You're starting a free trial of the ${PLANS[intent.tier].name}. No card needed.`
            : description
      }
      footer={
        <>
          Already have an account?{" "}
          <Link
            href={appPath(`/sign-in${nextQuery}`)}
            className="font-medium text-primary hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <SignUpForm
        next={next}
        defaultEmail={email}
        termsUrl={legalDocuments.terms.url}
        privacyUrl={legalDocuments.privacy.url}
      />
    </AuthCard>
  );
}

export default function SignUpPage(props: PageProps<"/app/sign-up">) {
  return (
    <Suspense
      fallback={
        <AuthCard title={title} description={description}>
          {null}
        </AuthCard>
      }
    >
      <SignUp {...props} />
    </Suspense>
  );
}
