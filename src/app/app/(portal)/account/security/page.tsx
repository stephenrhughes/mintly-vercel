import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePortalViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

import { EnrollMfa } from "./enroll-mfa";
import { RemoveFactorForm } from "./remove-factor-form";

export const metadata: Metadata = { title: "Two-step verification" };

const title = "Two-step verification";
const description =
  "Use an authenticator app, such as 1Password, Google Authenticator or Microsoft Authenticator.";

export default function SecurityPage(props: PageProps<"/app/account/security">) {
  return (
    <Suspense fallback={<PageHeader title={title} description={description} />}>
      <Security {...props} />
    </Suspense>
  );
}

// SEC-01: MFA with an authenticator app. Required for Mintly admins,
// optional for customers.
async function Security({ searchParams }: PageProps<"/app/account/security">) {
  const [user, params] = await Promise.all([
    requirePortalViewer("/account/security"),
    searchParams,
  ]);
  if (user.viewAs) {
    // ADM-13: someone else's authenticator apps are theirs alone.
    return (
      <div className="grid gap-8">
        <PageHeader title={title} description={description} />
        <Alert>
          <AlertDescription>
            Two-step verification settings aren&apos;t shown while viewing as a customer.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const factors = data?.totp ?? [];

  return (
    <div className="grid gap-8">
      <PageHeader title={title} description={description} />

      {params.required === "admin" && user.isMintlyAdmin && factors.length === 0 ? (
        <Alert variant="destructive">
          <ShieldAlert aria-hidden />
          <AlertTitle>Set up two-step verification to use the admin area</AlertTitle>
          <AlertDescription>Mintly admins must sign in with an authenticator app.</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Authenticator apps</CardTitle>
          <CardDescription>
            {factors.length > 0
              ? "You'll be asked for a code from one of these apps each time you sign in."
              : "No authenticator app is set up yet."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          {factors.length > 0 ? (
            <ul className="grid gap-3">
              {factors.map((factor) => (
                <li
                  key={factor.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                >
                  <div>
                    <p className="font-medium">{factor.friendly_name ?? "Authenticator app"}</p>
                    <p className="text-sm text-muted-foreground">
                      Added{" "}
                      {new Date(factor.created_at).toLocaleDateString("en-GB", {
                        dateStyle: "long",
                      })}
                    </p>
                  </div>
                  <RemoveFactorForm factorId={factor.id} />
                </li>
              ))}
            </ul>
          ) : null}
          <EnrollMfa hasFactors={factors.length > 0} />
        </CardContent>
      </Card>
    </div>
  );
}
