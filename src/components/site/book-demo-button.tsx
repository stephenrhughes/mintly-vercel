"use client";

import { CalendarDays } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";

// "Book a call" (WEB-06), with Cal.com's month view. The embed script is
// imported on the first click, so it costs nothing on page load.
const CAL_USER = "stephen-hughes-h2flha";
const MEETINGS = {
  api: "introduction-to-mintly-bank-account-checker-apis",
  eiscd: "interest-in-eiscd-licence",
} as const;

export function BookDemoButton({
  label = "Book a call with us",
  meeting = "api",
  variant = "secondary",
  size = "default",
  className,
  showIcon = true,
}: {
  label?: string;
  meeting?: keyof typeof MEETINGS;
  variant?: "default" | "secondary" | "outline" | "ghost" | "onDark";
  size?: "default" | "sm" | "lg";
  className?: string;
  showIcon?: boolean;
}) {
  const [opening, setOpening] = useState(false);
  const namespace = MEETINGS[meeting];

  async function open() {
    setOpening(true);
    track("book_demo", { meeting });
    try {
      const { getCalApi } = await import("@calcom/embed-react");
      const cal = await getCalApi({ namespace });
      cal("ui", { hideEventTypeDetails: false, layout: "month_view" });
      cal("modal", {
        calLink: `${CAL_USER}/${namespace}`,
        config: { layout: "month_view", useSlotsViewOnSmallScreen: "true", theme: "auto" },
      });
    } catch {
      // The embed failed (blocked, offline): fall back to the booking page.
      window.open(`https://cal.com/${CAL_USER}/${namespace}`, "_blank", "noopener");
    } finally {
      setOpening(false);
    }
  }

  const onDark = variant === "onDark";
  return (
    <Button
      type="button"
      size={size}
      variant={onDark ? "outline" : variant}
      className={
        onDark
          ? `border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white ${className ?? ""}`
          : className
      }
      onClick={open}
      disabled={opening}
    >
      {showIcon && <CalendarDays aria-hidden />}
      {label}
    </Button>
  );
}
