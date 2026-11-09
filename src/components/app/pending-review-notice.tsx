import { Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { siteConfig } from "@/lib/site";

// APPR-03: a pending organisation is told what's happening, how long it
// usually takes, and what it can do in the meantime.
export function PendingReviewNotice({ orgName }: { orgName: string }) {
  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-5 text-primary" aria-hidden /> We&apos;re reviewing your account
        </CardTitle>
        <CardDescription>
          We review new trials to keep Mintly safe for everyone. Reviews usually take less than one
          working day, and we&apos;ll email you as soon as {orgName} is approved. Your 14-day trial
          starts then, so you won&apos;t lose any of it.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <p>
          In the meantime, read the documentation and try the API against the sandbox, which returns
          fixed test values. Questions? Email {siteConfig.supportEmail}.
        </p>
        <div>
          <Button asChild variant="outline" size="sm">
            <a href={`${siteConfig.canonicalUrl}/docs`} target="_blank" rel="noreferrer">
              Read the documentation
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** For declined and suspended organisations: no reason given (plan §6.11). */
export function AccountUnavailableNotice({ suspended }: { suspended: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {suspended ? "Your account is suspended" : "Your account wasn't approved"}
        </CardTitle>
        <CardDescription>
          {suspended
            ? "Your API key and the web tools are turned off."
            : "We're unable to offer a trial for this account."}{" "}
          If you think this is a mistake, email {siteConfig.supportEmail}.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
