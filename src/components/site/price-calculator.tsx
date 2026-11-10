"use client";

import { Check } from "lucide-react";
import { useMemo, useState } from "react";

import { BookDemoButton } from "@/components/site/book-demo-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { track } from "@/lib/analytics";
import {
  buildQuote,
  formatMoney,
  formatPence,
  formatRequests,
  MAX_SEATS,
  requestsToSlider,
  sanitiseRequests,
  sanitiseSeats,
  SLIDER_STEPS,
  sliderToRequests,
} from "@/lib/billing/price-calculator";
import { salesToAppHref } from "@/lib/hosts";
import { cn } from "@/lib/utils";

// The price calculator (WEB-05), ported from PriceCalculator.js. Entirely in
// the browser: nothing is sent anywhere. The maths is in price-calculator.ts.
const DEFAULT_REQUESTS = 5000;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </li>
  );
}

export function PriceCalculator() {
  // Inputs hold raw text so a field can be cleared and retyped; values are
  // sanitised for the sums and normalised on blur.
  const [requestsInput, setRequestsInput] = useState(String(DEFAULT_REQUESTS));
  const [seatsInput, setSeatsInput] = useState("1");
  const [includeEiscd, setIncludeEiscd] = useState(false);

  const requests = sanitiseRequests(requestsInput);
  const seats = sanitiseSeats(seatsInput);
  const quote = useMemo(
    () => buildQuote({ requests, seats, includeEiscd }),
    [requests, seats, includeEiscd],
  );
  const { recommended, isQuoteOnly, eiscd, totals } = quote;

  // EISCD is never self-serve, so wanting it always means a conversation.
  const needsCall = isQuoteOnly || includeEiscd || !recommended?.selfServe;
  const trackCta = (action: string) =>
    track("calculator_cta", {
      category: "PriceCalculator",
      label: `${recommended?.key ?? "none"}:${action}`,
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <form
        className="space-y-6 rounded-xl border bg-card p-6 shadow-xs"
        onSubmit={(e) => e.preventDefault()}
      >
        <h2 className="text-xl font-semibold">Your expected usage</h2>
        <div className="space-y-2">
          <Label htmlFor="monthlyChecks">Bank account checks per month</Label>
          <Input
            id="monthlyChecks"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={requestsInput}
            onChange={(e) => setRequestsInput(e.target.value)}
            onBlur={() => setRequestsInput(String(requests))}
          />
          <input
            type="range"
            min={0}
            max={SLIDER_STEPS}
            step={1}
            aria-label="Bank account checks per month"
            value={requestsToSlider(requests)}
            onChange={(e) => setRequestsInput(String(sliderToRequests(Number(e.target.value))))}
            className="w-full accent-[var(--primary)]"
          />
          <p className="text-xs text-muted-foreground">
            Drag for a rough figure, or type an exact one.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="teamSize">People needing access</Label>
          <Input
            id="teamSize"
            type="number"
            min={1}
            max={MAX_SEATS}
            step={1}
            inputMode="numeric"
            value={seatsInput}
            onChange={(e) => setSeatsInput(e.target.value)}
            onBlur={() => setSeatsInput(String(seats))}
          />
          <p className="text-xs text-muted-foreground">
            Anyone who signs in to the portal. API keys are not seats.
          </p>
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={includeEiscd}
            onChange={(e) => setIncludeEiscd(e.target.checked)}
          />
          <span>
            I also need the EISCD data file
            <span className="block text-xs text-muted-foreground">
              The full sort code directory, licensed annually and updated weekly.
            </span>
          </span>
        </label>
      </form>

      <div
        className="rounded-xl border border-primary bg-card p-6 shadow-sm ring-2 ring-primary/15"
        aria-live="polite"
      >
        <h2 className="text-sm font-semibold tracking-wide text-primary uppercase">
          {isQuoteOnly ? "Let's talk" : "Your best plan"}
        </h2>
        <h3 className="mt-1 text-2xl font-semibold">{recommended?.name ?? "No plan available"}</h3>
        {isQuoteOnly || !recommended ? (
          <p className="mt-3 text-muted-foreground">
            At {formatRequests(quote.requests)} checks a month we price per customer rather than off
            a list. Book a call and we will put a figure together, usually the same day.
          </p>
        ) : (
          <>
            <p className="mt-3">
              <span className="text-4xl font-semibold tabular-nums">
                {formatMoney(totals.monthlyGbp)}
              </span>{" "}
              <span className="text-sm text-muted-foreground">per month, excluding VAT</span>
            </p>
            <ul className="mt-4 divide-y border-y">
              <Row
                label={`${recommended.name} (${formatRequests(recommended.tier.includedRequestsCount)} checks included)`}
                value={formatMoney(recommended.tier.monthlyPriceGbp)}
              />
              {recommended.overageRequests > 0 && (
                <Row
                  label={`${formatRequests(recommended.overageRequests)} extra checks at ${formatPence(recommended.tier.overagePence)}`}
                  value={formatMoney(recommended.overageGbp)}
                />
              )}
              {eiscd && (
                <Row
                  label={`${eiscd.name} (${formatMoney(eiscd.annualGbp)} a year)`}
                  value={formatMoney(eiscd.monthlyGbp)}
                />
              )}
            </ul>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Per year</dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {formatMoney(totals.annualGbp)}
                </dd>
              </div>
              {quote.pencePerCheck !== null && (
                <div>
                  <dt className="text-muted-foreground">Effective per check</dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {formatPence(quote.pencePerCheck)}
                  </dd>
                </div>
              )}
            </dl>
          </>
        )}
        <div className="mt-6">
          {needsCall ? (
            <BookDemoButton
              label="Get a quote"
              variant="default"
              meeting={includeEiscd ? "eiscd" : "api"}
            />
          ) : (
            <Button asChild>
              <a
                href={salesToAppHref(`/subscribe?plan=${recommended!.key}`)}
                onClick={() => trackCta("trial")}
              >
                Start a free trial
              </a>
            </Button>
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          An estimate, not a quote. Prices exclude VAT.
          {!isQuoteOnly && " Trials start without a payment method."}
        </p>
      </div>

      <div className="lg:col-span-2">
        <h2 className="text-xl font-semibold">
          Every plan at {formatRequests(quote.requests)} checks a month
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The same usage costed against each plan, so you can see where the recommendation comes
          from.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th scope="col" className="p-3">
                  Plan
                </th>
                <th scope="col" className="p-3">
                  Included
                </th>
                <th scope="col" className="p-3">
                  Users
                </th>
                <th scope="col" className="p-3 text-right">
                  Cost per month
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {quote.tiers.map((row) => {
                const best = row.key === recommended?.key;
                return (
                  <tr key={row.key} className={cn(best && "bg-secondary")}>
                    <th scope="row" className="p-3 text-left font-medium">
                      <span className="inline-flex items-center gap-2">
                        {row.name}
                        {best && <Check className="size-4 text-primary" aria-label="Recommended" />}
                      </span>
                    </th>
                    <td className="p-3 tabular-nums">
                      {Number.isFinite(row.tier.includedRequestsCount)
                        ? formatRequests(row.tier.includedRequestsCount)
                        : "Custom"}
                    </td>
                    <td className="p-3">
                      {Number.isFinite(row.tier.maxUsers) ? row.tier.maxUsers : "Unlimited"}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {row.quoteOnly ? (
                        "On request"
                      ) : row.available ? (
                        formatMoney(row.monthlyGbp)
                      ) : (
                        <span className="text-muted-foreground">{row.reason}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
