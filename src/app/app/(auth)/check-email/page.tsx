import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { getPendingEmail } from "@/lib/auth/pending-email";
import { safeNextPath } from "@/lib/hosts";
import { siteConfig } from "@/lib/site";

import { ConfirmForm } from "./confirm-form";

export const metadata: Metadata = { title: "Confirm your email" };

const title = "Check your email";

// AUTH-03: confirm the address with the emailed code. The email also has a
// link that does the same from this browser.
async function CheckEmail({ searchParams }: PageProps<"/app/check-email">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  const email = await getPendingEmail();

  return (
    <AuthCard
      title={title}
      description={
        email ? (
          <>
            We&apos;ve sent a 6-digit code to <strong className="text-foreground">{email}</strong>.
            Enter it below, or use the link in the email.
          </>
        ) : (
          "Enter the email address you signed up with and the 6-digit code we sent you."
        )
      }
      footer={
        <>
          Can&apos;t find it? Check your spam or junk folder. Still nothing? Email{" "}
          <a
            href={`mailto:${siteConfig.supportEmail}`}
            className="font-medium text-primary hover:underline"
          >
            {siteConfig.supportEmail}
          </a>
          .
        </>
      }
    >
      <ConfirmForm next={next} needsEmail={!email} />
    </AuthCard>
  );
}

export default function CheckEmailPage(props: PageProps<"/app/check-email">) {
  return (
    <Suspense fallback={<AuthCard title={title}>{null}</AuthCard>}>
      <CheckEmail {...props} />
    </Suspense>
  );
}
