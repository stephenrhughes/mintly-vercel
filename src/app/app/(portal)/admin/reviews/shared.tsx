import { CircleCheck, CircleHelp, CircleX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ReviewStatus } from "@/lib/nav";

// Small pieces shared by the review pages.

export const dateTime = (date: Date) =>
  date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });

const statusText: Record<ReviewStatus, string> = {
  pending_review: "Pending review",
  approved: "Approved",
  rejected: "Declined",
  suspended: "Suspended",
};

export function StatusBadge({ status }: { status: ReviewStatus }) {
  const variant =
    status === "approved" ? "default" : status === "pending_review" ? "secondary" : "outline";
  return <Badge variant={variant}>{statusText[status]}</Badge>;
}

/** A yes / no / unknown signal, with words as well as an icon. */
export function Check({
  value,
  yes,
  no,
}: {
  value: boolean | null | undefined;
  yes: string;
  no: string;
}) {
  if (value === true) {
    return (
      <span className="inline-flex items-center gap-1 text-primary">
        <CircleCheck className="size-4" aria-hidden /> {yes}
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center gap-1 text-destructive">
        <CircleX className="size-4" aria-hidden /> {no}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <CircleHelp className="size-4" aria-hidden /> Unknown
    </span>
  );
}

export const actionText: Record<string, string> = {
  "review.approve": "Approved",
  "review.ask_info": "Asked for information",
  "review.decline": "Declined",
  "review.expire": "Expired after 7 days",
  "review.suspend": "Suspended",
  "review.reinstate": "Reinstated",
  "domain.trust": "Trusted a domain",
  "domain.block": "Blocked a domain",
  "domain.untrust": "Removed a trusted domain",
  "domain.unblock": "Removed a blocked domain",
};
