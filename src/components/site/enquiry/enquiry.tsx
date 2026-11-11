"use client";

import { ArrowLeft, Info, Loader2, Send } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";

import { captchaToken, preloadRecaptcha, RECAPTCHA_SITE_KEY } from "@/components/recaptcha";
import { RecaptchaNotice } from "@/components/recaptcha-notice";
import { BookDemoButton } from "@/components/site/book-demo-button";
import { submitEnquiry } from "@/components/site/enquiry/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { track } from "@/lib/analytics";
import { PLANS } from "@/lib/billing/plans";
import {
  type Answers,
  CONFIRMS,
  type Contact,
  CONTACT,
  estimateMonthlyFailureCost,
  FAILURES,
  formatPounds,
  getOutcome,
  getVisibleQuestions,
  needsCopExplainer,
  PRODUCT,
} from "@/lib/enquiry/qualification";
import { SALES_EMAIL } from "@/lib/marketing/contact";
import { cn } from "@/lib/utils";

// The qualification enquiry (LEAD-01), ported from mintly-web Enquiry.js:
// one question at a time, back always available, contact details last,
// then an ending that names a product and plan, or says we're not the fit.
// See docs/enquiry-qualification-spec.md.

const EMPTY_CONTACT: Required<Contact> = { name: "", email: "", company: "", phone: "", notes: "" };

export function Enquiry({ product }: { product?: "api" | "eiscd" }) {
  const pathname = usePathname();
  // Pre-selected from the host page, never skipped.
  const [answers, setAnswers] = useState<Answers>(() => (product ? { [PRODUCT]: product } : {}));
  const [stepIndex, setStepIndex] = useState(0);
  const [showCop, setShowCop] = useState(false);
  const [leftOverCop, setLeftOverCop] = useState(false);
  const [contact, setContact] = useState(EMPTY_CONTACT);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  const questions = useMemo(() => getVisibleQuestions(answers), [answers]);
  // Changing an earlier answer can shorten the flow under the current step.
  const position = Math.min(stepIndex, questions.length - 1);
  const question = questions[position];
  const outcome = useMemo(() => getOutcome(answers), [answers]);
  const estimate = useMemo(() => estimateMonthlyFailureCost(answers), [answers]);

  const advance = () => {
    track("enquiry_step", { category: "Enquiry", label: question.id });
    setStepIndex((current) => current + 1);
  };
  const goBack = () => {
    if (showCop) setShowCop(false);
    else setStepIndex((current) => Math.max(0, current - 1));
  };

  const answerSingle = (id: string, value: string) => {
    const next = { ...answers, [id]: value };
    setAnswers(next);
    if (id === CONFIRMS && needsCopExplainer(next)) {
      setShowCop(true);
      return;
    }
    advance();
  };

  const toggleMulti = (id: string, value: string) => {
    const current = (answers[id] as string[] | undefined) ?? [];
    const exclusive = question.exclusiveOption;
    let next: string[];
    if (value === exclusive) next = current.includes(value) ? [] : [value];
    else if (current.includes(value)) next = current.filter((entry) => entry !== value);
    else next = [...current.filter((entry) => entry !== exclusive), value];
    setAnswers((previous) => ({ ...previous, [id]: next }));
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setFailed(false);
    const result = await submitEnquiry({
      answers: Object.fromEntries(
        Object.entries(answers).filter(([, v]) => v !== undefined),
      ) as Record<string, string | string[]>,
      contact,
      sourcePage: pathname ?? null,
      token: await captchaToken("enquiry"),
    }).catch(() => ({ ok: false as const, error: "failed" as const }));
    if (result.ok) {
      // Only the outcome goes to analytics, never who sent it.
      track("enquiry_sent", { category: "Enquiry", label: result.outcomeId });
      setSent(true);
    } else {
      setFailed(true);
    }
    setSending(false);
  }

  const plan = outcome.type === "plan" ? PLANS[outcome.plan] : null;

  return (
    <div className="mx-auto max-w-2xl rounded-xl border bg-card p-6 shadow-sm sm:p-8">
      {!sent && !leftOverCop && (
        <>
          <h2 className="text-2xl font-semibold tracking-tight">
            Let&apos;s work out if we can help
          </h2>
          {position === 0 && !showCop && (
            <p className="mt-2 text-muted-foreground">
              A handful of questions — most people are through in under a minute. At the end
              we&apos;ll tell you which of our products fits, what it costs, and whether you&apos;d
              be better off somewhere else.
            </p>
          )}
        </>
      )}

      <div className="mt-6">
        {sent ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-secondary p-4">
              <p className="font-semibold">
                Thanks — your enquiry is with us, and a copy is on its way to {contact.email}.
              </p>
            </div>
            {answers[FAILURES] === "none" ? (
              <p>
                Sounds like you have this under control already — most of our customers use us to
                keep it that way as they grow.
              </p>
            ) : estimate ? (
              <p>
                Based on what you&apos;ve told us, wrong bank details are costing you in the region
                of <strong>{formatPounds(estimate)} a month</strong>.
                {plan &&
                  ` Checking ${plan.includedRequests} accounts with Mintly costs ${plan.monthlyPrice} a month.`}
              </p>
            ) : null}
            {plan && (
              <div>
                <h3 className="text-lg font-semibold">
                  At your volume, the {plan.name} is the one that fits
                </h3>
                <p className="mt-2 text-muted-foreground">
                  {plan.monthlyPrice} a month covers {plan.includedRequests} checks, then{" "}
                  {plan.pricePerRequest} each. {plan.includedUsers}, and up to {plan.throttle}{" "}
                  checks a second. There&apos;s a 14-day free trial and no card needed to start it.
                </p>
                <Button asChild className="mt-4">
                  <Link href="/pricing">Start your free trial</Link>
                </Button>
              </div>
            )}
            {outcome.type === "call" && (
              <div>
                <h3 className="text-lg font-semibold">This one is worth a conversation</h3>
                <p className="mt-2 text-muted-foreground">
                  {outcome.meeting === "eiscd"
                    ? "Licensing the directory depends on how you'll use it, how often you need it and how many sites it covers, so we price it per customer rather than off a list."
                    : "We can answer this properly on a call:"}
                  {outcome.reasons.length > 0 && ` ${outcome.reasons.join(", and ")}.`}
                </p>
                <BookDemoButton
                  meeting={outcome.meeting}
                  label="Book a call"
                  variant="default"
                  className="mt-4"
                />
              </div>
            )}
            {outcome.type === "enquiry" && (
              <div>
                <p className="text-muted-foreground">
                  We&apos;ll come back to you with a recommendation. If you&apos;d rather talk it
                  through, book a time that suits you.
                </p>
                <BookDemoButton label="Book a call" variant="outline" className="mt-4" />
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Make sure you don&apos;t miss our email — add {SALES_EMAIL} to your address book.
            </p>
          </div>
        ) : leftOverCop ? (
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Then we&apos;re not the right fit — and that&apos;s fine
            </h2>
            <p className="mt-3 text-muted-foreground">
              Confirmation of Payee is offered by a handful of providers connected to the Pay.UK CoP
              service, and we aren&apos;t one of them. It&apos;s worth knowing that CoP is priced
              per check and usually costs several times what validation does, so plenty of teams
              still put a validation step in front of it.
            </p>
            <p className="mt-3 text-muted-foreground">
              <Link href="/faq#confirmation-of-payee" className="text-primary underline">
                Our FAQ explains the difference
              </Link>
              , and if you want to talk it through anyway, we&apos;re on {SALES_EMAIL}.
            </p>
          </div>
        ) : showCop ? (
          <div>
            <div className="rounded-lg border bg-secondary p-4">
              <h3 className="flex items-center gap-2 font-semibold">
                <Info className="size-4" aria-hidden />
                Name matching is a separate service, and we don&apos;t provide it
              </h3>
              <p className="mt-2 text-sm">
                Checking that the account holder&apos;s name matches is called Confirmation of
                Payee. What we do is the layer underneath: we confirm the sort code and account
                number are real, correctly formed and reachable by BACS, Faster Payments, CHAPS or
                ICS.
              </p>
              <p className="mt-2 text-sm">
                Most teams run that check first — it&apos;s fast and costs pence — and send only
                what survives to a CoP provider. If that&apos;s useful to you, keep going and
                we&apos;ll show you what it costs. If it isn&apos;t, no hard feelings.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setShowCop(false);
                  advance();
                }}
              >
                Keep going
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  track("enquiry_cop_exit", {
                    category: "Enquiry",
                    label: String(answers[CONFIRMS]),
                  });
                  setLeftOverCop(true);
                }}
              >
                That&apos;s not what I need
              </Button>
              <Button variant="ghost" onClick={goBack}>
                <ArrowLeft aria-hidden /> Back
              </Button>
            </div>
          </div>
        ) : question.id === CONTACT ? (
          <form onSubmit={onSubmit} onFocus={() => preloadRecaptcha()} className="space-y-3">
            <Progress value={100} className="h-1" aria-label="Last step" />
            <h3 className="pt-2 text-lg font-semibold">Where should we send this?</h3>
            <p className="text-sm text-muted-foreground">
              We&apos;ll show you what we&apos;d recommend on the next screen, and send the same
              thing by email.
            </p>
            {(
              [
                ["name", "Your name", "text", true, "name"],
                ["email", "Work email address", "email", true, "email"],
                ["company", "Company", "text", true, "organization"],
                ["phone", "Phone number (optional)", "tel", false, "tel"],
              ] as const
            ).map(([name, label, type, required, autoComplete]) => (
              <Input
                key={name}
                name={name}
                type={type}
                required={required}
                autoComplete={autoComplete}
                aria-label={label}
                placeholder={label}
                maxLength={name === "phone" ? 50 : 200}
                value={contact[name]}
                onChange={(e) => setContact((current) => ({ ...current, [name]: e.target.value }))}
              />
            ))}
            <Textarea
              name="notes"
              aria-label="Message"
              placeholder="Anything else you'd like to tell us (optional)"
              rows={3}
              maxLength={5000}
              value={contact.notes}
              onChange={(e) => setContact((current) => ({ ...current, notes: e.target.value }))}
            />
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="submit" disabled={sending}>
                {sending ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden /> Sending...
                  </>
                ) : (
                  <>
                    <Send aria-hidden /> See what we&apos;d recommend
                  </>
                )}
              </Button>
              <Button type="button" variant="ghost" onClick={goBack}>
                <ArrowLeft aria-hidden /> Back
              </Button>
            </div>
            {RECAPTCHA_SITE_KEY && <RecaptchaNotice />}
          </form>
        ) : (
          <div>
            <Progress
              value={((position + 1) / questions.length) * 100}
              className="h-1"
              aria-label={`Question ${position + 1} of ${questions.length}`}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Question {position + 1} of {questions.length}
            </p>
            <h3 className="mt-1 text-lg font-semibold">{question.prompt}</h3>
            {question.help && <p className="text-sm text-muted-foreground">{question.help}</p>}
            {question.type === "single" && (
              <div className="mt-4 grid gap-2">
                {question.options!.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={answers[question.id] === option.value}
                    onClick={() => answerSingle(question.id, option.value)}
                    className={cn(
                      "rounded-lg border px-4 py-3 text-left text-sm transition-colors hover:border-primary hover:bg-secondary",
                      answers[question.id] === option.value && "border-primary bg-secondary",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
            {question.type === "multi" && (
              <div className="mt-4 space-y-2">
                {question.options!.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-start gap-3 rounded-lg border px-4 py-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={((answers[question.id] as string[] | undefined) ?? []).includes(
                        option.value,
                      )}
                      onChange={() => toggleMulti(question.id, option.value)}
                    />
                    {option.label}
                  </label>
                ))}
                <Button className="mt-2" onClick={advance}>
                  Continue
                </Button>
              </div>
            )}
            <div className="mt-4 flex gap-2">
              {position > 0 && (
                <Button variant="ghost" onClick={goBack}>
                  <ArrowLeft aria-hidden /> Back
                </Button>
              )}
              {question.optional && question.type === "single" && (
                <Button variant="ghost" onClick={advance}>
                  Skip this one
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {failed && (
        <div role="alert" className="mt-4 rounded-lg bg-destructive/5 p-4 text-sm">
          <p className="font-semibold">Sorry, we couldn&apos;t send your enquiry.</p>
          <p className="mt-1">Please try again, or email us directly at {SALES_EMAIL}.</p>
        </div>
      )}
    </div>
  );
}
