"use client";

import { CheckCircle2, Loader2, Lock, Star, XCircle } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useState, useSyncExternalStore } from "react";

import { captchaToken, preloadRecaptcha, RECAPTCHA_SITE_KEY } from "@/components/recaptcha";
import { RecaptchaNotice } from "@/components/recaptcha-notice";
import { BookDemoButton } from "@/components/site/book-demo-button";
import { CheckList } from "@/components/site/check-list";
import { submitRating } from "@/components/site/free-checker/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { track, trackConversion } from "@/lib/analytics";
import { isValidAccountNumber, isValidSortCode } from "@/lib/bank-api/requests";
import { FREE_CHECK_WEEKLY_LIMIT } from "@/lib/free-check/limits";
import {
  hasCookie,
  hasReachedLimit,
  nextMondayMidnight,
  OFFER_DISMISSED_COOKIE,
  promptAfterCheck,
  RATING_COOKIE,
  readFreeTries,
  remainingChecks,
  triesCookie,
} from "@/lib/free-check/logic";

// The public free sort code checker (FREE-01 to FREE-04), ported from
// mintly-web TryIt.js. Calls POST /api/free-check; the answer is VALID with
// the bank's name, or INVALID. The count cookie only mirrors the server's
// per-IP limit, and it is a functional cookie: the old checker also set the
// cookie banner's consent cookie, which this one never touches.

type Result =
  | { kind: "valid"; bank: string | null; combination: boolean }
  | { kind: "invalid"; combination: boolean }
  | { kind: "limit" }
  | { kind: "wait" }
  | { kind: "error" };

const LOCKED_FIELDS = ["Branch Name", "Address", "BIC", "Payment Types"];

const subscribe = () => () => {};
const readTries = () => readFreeTries(document.cookie);

export function FreeChecker() {
  // The page is static, so the count is read after hydration.
  const storedTries = useSyncExternalStore(subscribe, readTries, () => 0);
  const [tries, setTries] = useState<number | null>(null);
  const used = tries ?? storedTries;
  const [sortCode, setSortCode] = useState("");
  const [account, setAccount] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [prompt, setPrompt] = useState<"rating" | "offer" | null>(null);

  const sortCodeValid = sortCode === "" || isValidSortCode(sortCode);
  const accountValid = isValidAccountNumber(account);
  const limitReached = hasReachedLimit(used);

  // Returning visitors near the limit see the offer, as before.
  useEffect(() => {
    if (storedTries >= 8 && !hasCookie(document.cookie, OFFER_DISMISSED_COOKIE)) {
      const timer = setTimeout(() => setPrompt("offer"), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [storedTries]);

  function record(next: number) {
    setTries(next);
    document.cookie = triesCookie(next);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isValidSortCode(sortCode) || !accountValid || limitReached) return;
    setBusy(true);
    setResult(null);
    const combination = account.trim() !== "";
    track("try_it", { category: "TryIt" });
    trackConversion();
    try {
      const token = await captchaToken("free_check");
      const response = await fetch("/api/free-check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sortCode, accountNumber: account, token }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        status?: string;
        bank?: string | null;
        used?: number;
        error?: string;
      };
      if (response.status === 200) {
        const next = Math.max(used + 1, body.used ?? 0);
        record(next);
        setResult(
          body.status === "VALID"
            ? { kind: "valid", bank: body.bank ?? null, combination }
            : { kind: "invalid", combination },
        );
        const followUp = promptAfterCheck(next, {
          alreadyRated: hasCookie(document.cookie, RATING_COOKIE),
          offerDismissed: hasCookie(document.cookie, OFFER_DISMISSED_COOKIE),
        });
        if (followUp) setTimeout(() => setPrompt(followUp), followUp === "rating" ? 1500 : 3000);
      } else if (response.status === 429 && body.error === "weekly_limit") {
        // The server's per-IP count is the truth (a shared office IP, say).
        record(FREE_CHECK_WEEKLY_LIMIT);
        setResult({ kind: "limit" });
        if (!hasCookie(document.cookie, OFFER_DISMISSED_COOKIE)) setPrompt("offer");
      } else if (response.status === 429) {
        setResult({ kind: "wait" });
      } else {
        setResult({ kind: "error" });
      }
    } catch {
      setResult({ kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  function closeOffer() {
    setPrompt(null);
    if (limitReached) {
      document.cookie = `${OFFER_DISMISSED_COOKIE}=true; Path=/; Expires=${nextMondayMidnight().toUTCString()}; SameSite=Lax`;
    }
  }

  return (
    <div className="grid gap-6 rounded-xl border bg-card p-6 shadow-sm md:grid-cols-2">
      <form
        onSubmit={onSubmit}
        onFocus={() => preloadRecaptcha()}
        noValidate
        aria-label="Free sort code checker"
      >
        <h3 className="text-lg font-semibold">Check an account or sort code</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="fc-sort-code">Sort code</Label>
            <Input
              id="fc-sort-code"
              name="sortCode"
              placeholder="e.g. 12-34-56"
              inputMode="numeric"
              autoComplete="off"
              required
              value={sortCode}
              aria-invalid={!sortCodeValid}
              aria-describedby={!sortCodeValid ? "fc-sort-code-error" : undefined}
              onChange={(e) => setSortCode(e.target.value)}
            />
            {!sortCodeValid && (
              <p id="fc-sort-code-error" className="text-xs text-destructive">
                Must be 6 digits
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fc-account">
              Account number <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="fc-account"
              name="accountNumber"
              placeholder="e.g. 12345678"
              inputMode="numeric"
              autoComplete="off"
              value={account}
              aria-invalid={!accountValid}
              aria-describedby={!accountValid ? "fc-account-error" : undefined}
              onChange={(e) => setAccount(e.target.value)}
            />
            {!accountValid && (
              <p id="fc-account-error" className="text-xs text-destructive">
                Must be between 6 and 10 digits
              </p>
            )}
          </div>
        </div>
        {limitReached ? (
          <div className="mt-4 rounded-lg bg-secondary p-4 text-sm">
            <p className="font-semibold">Free checks used for this week!</p>
            <p className="mt-1">You can get 100 more checks by starting a free trial</p>
            <Button asChild size="sm" className="mt-3">
              <Link href="/pricing">Pricing</Link>
            </Button>
          </div>
        ) : (
          <>
            <Button
              type="submit"
              className="mt-4 w-full"
              disabled={busy || !sortCode || !sortCodeValid || !accountValid}
            >
              {busy ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden /> Checking…
                </>
              ) : (
                "Validate"
              )}
            </Button>
            <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">
              Free checks remaining this week: <strong>{remainingChecks(used)}</strong>
            </p>
          </>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          This tool processes sort code and account number only - no names are collected. By
          submitting details, you confirm you&apos;re the data controller for that data, and our{" "}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/terms" className="underline">
            Terms &amp; Conditions
          </Link>{" "}
          - which include our{" "}
          <a href="/assets/docs/Data%20Processing%20Addendum.pdf" className="underline">
            Data Processing Addendum
          </a>{" "}
          - govern how we process it on your behalf.
        </p>
        {RECAPTCHA_SITE_KEY && <RecaptchaNotice className="mt-2 text-xs text-muted-foreground" />}
      </form>

      <div aria-live="polite">
        <h3 className="text-lg font-semibold">Validation Result</h3>
        <div className="mt-4">
          <ResultPanel busy={busy} result={result} />
        </div>
      </div>

      <RatingDialog open={prompt === "rating"} onClose={() => setPrompt(null)} />
      <Dialog open={prompt === "offer"} onOpenChange={(open) => !open && closeOffer()}>
        <DialogContent>
          <DialogTitle>Try our tools free for 14 days?</DialogTitle>
          <DialogDescription>Check up to 100 accounts and sort codes.</DialogDescription>
          <CheckList
            className="text-sm"
            items={[
              "Checks whether the account is valid",
              "Shows all the branch contact information in our database",
              "Confirm the payment types that the branch supports",
              "All UK and Ireland banks supported",
              "Check IBAN and SWIFT codes for international payments",
              "No payment details required",
            ]}
          />
          <Button asChild>
            <Link href="/pricing">Start a free trial</Link>
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ResultPanel({ busy, result }: { busy: boolean; result: Result | null }) {
  if (busy) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Checking…
      </div>
    );
  }
  if (!result) return <p className="text-muted-foreground">Enter sort code and account to begin</p>;

  const trialButtons = (
    <div className="mt-4 flex flex-wrap gap-2">
      <Button asChild size="sm">
        <Link href="/pricing" onClick={() => track("unlock_teaser_clicked", { category: "TryIt" })}>
          Pricing
        </Link>
      </Button>
      <BookDemoButton label="Book a call" size="sm" variant="outline" />
    </div>
  );

  switch (result.kind) {
    case "valid":
      return (
        <div className="rounded-lg border border-primary/30 bg-secondary p-4">
          <p className="flex items-center gap-2 font-semibold text-primary">
            <CheckCircle2 className="size-5" aria-hidden />
            {result.combination ? "Valid sort code and account" : "Valid sort code"}
          </p>
          <p className="mt-2">Bank Name: {result.bank ?? "—"}</p>
          <p className="mt-4 text-sm font-medium">Unlock more with a free trial</p>
          <ul className="mt-2 space-y-1 text-sm">
            {LOCKED_FIELDS.map((label) => (
              <li key={label} className="flex items-center gap-2 text-muted-foreground">
                <Lock className="size-3.5" aria-hidden />
                <span className="w-28">{label}</span>
                <span aria-hidden className="blur-[3px] select-none">
                  █████████
                </span>
                <span className="sr-only">available with a trial</span>
              </li>
            ))}
          </ul>
          {trialButtons}
        </div>
      );
    case "invalid":
      return (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="flex items-center gap-2 font-semibold text-destructive">
            <XCircle className="size-5" aria-hidden />
            {result.combination ? "Invalid account / sort code combination" : "Invalid sort code"}
          </p>
          <p className="mt-2 text-sm">
            {result.combination
              ? "This account number and sort code don't match."
              : "This sort code doesn't exist."}
          </p>
          <p className="mt-3 text-sm">Get 100 more checks during our free trial</p>
          {trialButtons}
        </div>
      );
    case "limit":
      return (
        <div className="rounded-lg bg-secondary p-4">
          <p className="font-semibold">This check couldn&apos;t be completed</p>
          <p className="mt-2 text-sm">
            You&apos;ve reached this week&apos;s free check limit. Start a free trial to get 100
            more checks.
          </p>
          {trialButtons}
        </div>
      );
    case "wait":
      return (
        <div className="rounded-lg bg-secondary p-4 text-sm">
          <p className="font-semibold">One moment</p>
          <p className="mt-1">That was quick! Wait a couple of seconds and try again.</p>
        </div>
      );
    case "error":
      return (
        <div className="rounded-lg bg-destructive/5 p-4 text-sm">
          <p className="font-semibold">Something went wrong</p>
          <p className="mt-1">We couldn&apos;t complete that check. Please try again.</p>
        </div>
      );
  }
}

function RatingDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");

  function close() {
    onClose();
    setRating(0);
    setFeedback("");
    setState("idle");
  }

  async function send() {
    setState("sending");
    const result = await submitRating({
      rating,
      feedback: rating <= 3 ? feedback : undefined,
      token: await captchaToken("rating"),
    });
    if (result.ok) {
      document.cookie = `${RATING_COOKIE}=true; Path=/; Max-Age=31536000; SameSite=Lax`;
      setState("done");
      setTimeout(close, 2000);
    } else {
      setState("idle");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent>
        <DialogTitle>How was your experience?</DialogTitle>
        {state === "done" ? (
          <p>Thank you for your feedback!</p>
        ) : (
          <>
            <DialogDescription>Rate your experience with our free tools:</DialogDescription>
            <div className="flex gap-1" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  role="radio"
                  aria-checked={rating === star}
                  aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHover(star)}
                  onMouseLeave={() => setHover(0)}
                  className="text-amber-500"
                >
                  <Star
                    className={`size-8 ${(hover || rating) >= star ? "fill-current" : ""}`}
                    aria-hidden
                  />
                </button>
              ))}
            </div>
            {rating > 0 && rating <= 3 && (
              <div className="space-y-1.5">
                <Label htmlFor="rating-feedback">How can we improve our tools?</Label>
                <Textarea
                  id="rating-feedback"
                  rows={3}
                  maxLength={2000}
                  value={feedback}
                  placeholder="Tell us what you think..."
                  onChange={(e) => setFeedback(e.target.value)}
                />
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={send} disabled={rating === 0 || state === "sending"}>
                {state === "sending" ? "Submitting..." : "Submit"}
              </Button>
              <Button variant="ghost" onClick={close}>
                Skip
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
