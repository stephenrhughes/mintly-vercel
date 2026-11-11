import type { Metadata } from "next";

import { Enquiry } from "@/components/site/enquiry/enquiry";
import { FaqExplorer } from "@/components/site/faq-explorer";
import { JsonLd } from "@/components/site/json-ld";
import { PageHero } from "@/components/site/page-hero";
import { Section, SectionHeading } from "@/components/site/section";
import { SupportChannels } from "@/components/site/support-channels";
import { FAQ_CATEGORIES, FAQS, plainText } from "@/content/faq";
import {
  SALES_EMAIL,
  SUPPORT_EMAIL,
  SUPPORT_HOURS,
  SUPPORT_PHONE,
  SUPPORT_PHONE_HREF,
} from "@/lib/marketing/contact";
import { faqPageJsonLd } from "@/lib/marketing/json-ld";
import { routeMetadata } from "@/lib/marketing/metadata";
import { pageInfo } from "@/lib/marketing/routes";

export const metadata: Metadata = routeMetadata("/faq");

const info = pageInfo("/faq", "FAQ & Support", "2022-10-05");

export default function FaqPage() {
  return (
    <>
      <JsonLd
        data={faqPageJsonLd(
          info.published,
          info.modified,
          FAQS.map((faq) => ({ question: faq.question, answer: plainText(faq.answer) })),
        )}
      />
      <PageHero
        compact
        title="FAQ & support for checking bank accounts"
        lead={
          <p>
            Search for answers about checking sort codes, account numbers and IBAN, our plans and
            our API. If yours isn&apos;t here, we&apos;re on{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">
              {SUPPORT_EMAIL}
            </a>{" "}
            and{" "}
            <a href={SUPPORT_PHONE_HREF} className="underline">
              {SUPPORT_PHONE}
            </a>
            .
          </p>
        }
      />

      <Section tone="muted">
        <SectionHeading title="How to contact Mintly support" />
        <div className="mt-8">
          <SupportChannels />
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          {SUPPORT_HOURS} - whichever you pick, it reaches the team that builds and runs Mintly.
          Sales, volumes and partnerships:{" "}
          <a href={`mailto:${SALES_EMAIL}`} className="text-primary underline">
            {SALES_EMAIL}
          </a>
          .
        </p>
      </Section>

      <Section>
        <SectionHeading
          title="Frequently asked questions"
          lead="Search for what you need, or pick a topic to narrow it down."
        />
        <div className="mt-8">
          <FaqExplorer faqs={FAQS} categories={FAQ_CATEGORIES} />
        </div>
      </Section>

      <Section id="contact" tone="muted">
        <SectionHeading
          title="Still not sure?"
          lead={
            <>
              If it concerns an account you already have - billing, a result that looks wrong,
              access for a colleague - email{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary underline">
                {SUPPORT_EMAIL}
              </a>{" "}
              and you&apos;ll get to us fastest. If you&apos;re working out whether Mintly fits,
              answer the few questions below and we&apos;ll tell you which product and plan
              we&apos;d recommend - including if the answer is that you need something we don&apos;t
              do.
            </>
          }
        />
        <div className="mt-8">
          <Enquiry />
        </div>
      </Section>
    </>
  );
}
