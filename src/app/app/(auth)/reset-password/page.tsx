import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { getPendingEmail } from "@/lib/auth/pending-email";
import { isRecentEmailVerification } from "@/lib/auth/recovery";
import { appPath } from "@/lib/hosts";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

const title = "Choose a new password";

async function ResetPassword({ searchParams }: PageProps<"/app/reset-password">) {
  const params = await searchParams;
  const sent = params.sent === "1";
  const email = await getPendingEmail();

  // Arriving from the email link signs the user in, so no code is needed.
  let signedIn = false;
  if (getSupabaseConfig()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    signedIn = isRecentEmailVerification(data?.currentAuthenticationMethods);
  }

  return (
    <AuthCard
      title={title}
      description={
        signedIn
          ? "Enter a new password for your account."
          : sent && email
            ? `If there's an account for ${email}, we've emailed it a 6-digit code. Enter it with your new password, or use the link in the email.`
            : "Enter the 6-digit code from the reset email and your new password."
      }
      footer={
        <Link
          href={appPath("/forgot-password")}
          className="font-medium text-primary hover:underline"
        >
          Send another reset email
        </Link>
      }
    >
      <ResetPasswordForm needsCode={!signedIn} needsEmail={!signedIn && !email} />
    </AuthCard>
  );
}

export default function ResetPasswordPage(props: PageProps<"/app/reset-password">) {
  return (
    <Suspense fallback={<AuthCard title={title}>{null}</AuthCard>}>
      <ResetPassword {...props} />
    </Suspense>
  );
}
