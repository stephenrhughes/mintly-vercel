"use client";

import { CalendarDays, Mail, MessageCircle, Phone } from "lucide-react";
import type { ReactNode } from "react";

import { BookDemoButton } from "@/components/site/book-demo-button";
import { openChat } from "@/components/site/chat";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import {
  SUPPORT_EMAIL,
  SUPPORT_HOURS,
  SUPPORT_HOURS_SHORT,
  SUPPORT_PHONE,
  SUPPORT_PHONE_HREF,
} from "@/lib/marketing/contact";

// The four ways to reach a human, shown above the FAQ (SupportChannels.js).
function Channel({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action: ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-xl border bg-card p-5 text-card-foreground shadow-sm">
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-secondary text-primary">
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 flex-1 text-sm text-muted-foreground">{children}</p>
      <div className="mt-4">{action}</div>
    </div>
  );
}

export function SupportChannels() {
  const log = (label: string) => () => track("support_channel", { category: "Support", label });
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Channel
        icon={<Mail className="size-5" aria-hidden />}
        title="Email support"
        action={
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            onClick={log("email")}
            className="text-sm font-medium text-primary underline"
          >
            {SUPPORT_EMAIL}
          </a>
        }
      >
        Your account, your bill, or a check that came back looking wrong.
      </Channel>
      <Channel
        icon={<MessageCircle className="size-5" aria-hidden />}
        title="Live chat"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              log("chat")();
              openChat();
            }}
          >
            Start a chat
          </Button>
        }
      >
        Quickest for a short question. Staffed {SUPPORT_HOURS_SHORT}; outside those hours, leave a
        message.
      </Channel>
      <Channel
        icon={<Phone className="size-5" aria-hidden />}
        title="Call us"
        action={
          <a
            href={SUPPORT_PHONE_HREF}
            onClick={log("phone")}
            className="text-sm font-medium text-primary underline"
          >
            {SUPPORT_PHONE}
          </a>
        }
      >
        Talk it through with someone who knows the service. {SUPPORT_HOURS}.
      </Channel>
      <Channel
        icon={<CalendarDays className="size-5" aria-hidden />}
        title="Book a call"
        action={<BookDemoButton variant="outline" size="sm" label="Pick a time" showIcon={false} />}
      >
        Half an hour on volumes, integration or EISCD licensing, at a time that suits you.
      </Channel>
    </div>
  );
}
