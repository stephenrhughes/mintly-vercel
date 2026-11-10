import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePortalViewer } from "@/lib/auth/session";
import { appPath } from "@/lib/hosts";

import { PasswordForm } from "./password-form";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Account settings" };

const title = "Account settings";
const description = "Your contact details, password and sign-in security.";

export default function AccountPage() {
  return (
    <Suspense fallback={<PageHeader title={title} description={description} />}>
      <Account />
    </Suspense>
  );
}

async function Account() {
  const user = await requirePortalViewer("/account");

  return (
    <div className="grid gap-8">
      <PageHeader title={title} description={description} />

      <Card>
        <CardHeader>
          <CardTitle>Your details</CardTitle>
          <CardDescription>
            Signed in as <strong className="text-foreground">{user.email}</strong>. To change your
            email address, contact support.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            defaults={{
              firstName: user.firstName ?? "",
              lastName: user.lastName ?? "",
              companyName: user.companyName ?? "",
              phone: user.phone ?? "",
              marketingOptOut: user.marketingOptOut,
            }}
          />
        </CardContent>
      </Card>

      {user.isSso ? null : (
        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>Choose a new password for signing in to Mintly.</CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Two-step verification</CardTitle>
          <CardDescription>
            {user.hasMfa
              ? "On. You'll be asked for a code from your authenticator app when you sign in."
              : "Off. Add an authenticator app for extra protection when you sign in."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href={appPath("/account/security")}>
              <ShieldCheck /> Manage two-step verification
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
