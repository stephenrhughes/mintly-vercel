"use client";

import Image from "next/image";
import Link from "next/link";
import { type FormEvent, useState } from "react";

import { captchaToken, preloadRecaptcha, RECAPTCHA_SITE_KEY } from "@/components/recaptcha";
import { RecaptchaNotice } from "@/components/recaptcha-notice";
import { captureEmail } from "@/components/site/email-capture/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { track } from "@/lib/analytics";

// LEAD-02: "The Finance Manager's 5-Minute BACS Compliance Checklist",
// ported from mintly-web RegisterEmail.js.
export function EmailCapture() {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openDialog() {
    track("open_download_modal", { category: "DownloadPdf" });
    preloadRecaptcha();
    setOpen(true);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSending(true);
    setError(null);
    const result = await captureEmail({
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      token: await captchaToken("email_capture"),
    }).catch(() => ({ ok: false as const, error: "Something went wrong. Please try again." }));
    setSending(false);
    if (result.ok) {
      track("confirm_download", { category: "DownloadPdf" });
      setDone(true);
      setOpen(false);
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={openDialog}
        aria-label="Get the free BACS compliance checklist"
      >
        <Image
          src="/assets/img/theme/pdf-checklist.png"
          alt="PDF Download sample"
          width={180}
          height={240}
        />
      </button>
      <p>
        Get your free PDF{" "}
        <b>&quot;The Finance Manager&apos;s 5-Minute BACS Compliance Checklist&quot;</b>
      </p>
      <p className="text-sm text-muted-foreground">
        Your short but handy guide to streamlining BACS payments
      </p>
      <Button onClick={openDialog}>Get the PDF</Button>
      {done && (
        <p className="text-sm font-medium text-primary">
          Thanks! Your free checklist is on its way!
        </p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Can we send you the checklist?</DialogTitle>
          <DialogDescription>
            Before we send you the checklist we need to ensure you&apos;re happy for us to send you
            marketing email. We&apos;ll never sell your data on to anyone or send you junk, ever.
          </DialogDescription>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="capture-name">Name</Label>
              <Input
                id="capture-name"
                name="name"
                required
                autoComplete="name"
                placeholder="Joe Bloggs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="capture-email">Work email</Label>
              <Input
                id="capture-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="financemanager@example.com"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              By clicking the button below you consent to receiving our email. You can unsubscribe
              at any time. See our{" "}
              <Link href="/privacy" className="underline">
                Privacy Policy
              </Link>{" "}
              for full details.
            </p>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={sending}>
              {sending ? "Sending..." : "I Agree"}
            </Button>
            {RECAPTCHA_SITE_KEY && <RecaptchaNotice />}
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
