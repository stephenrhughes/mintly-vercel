import Image from "next/image";
import Link from "next/link";

import { ConsentSettingsLink } from "@/components/site/consent/consent-settings-link";
import {
  COMPANY,
  SALES_EMAIL,
  SOCIAL_LINKS,
  SUPPORT_PHONE,
  SUPPORT_PHONE_HREF,
} from "@/lib/marketing/contact";
import { footerColumns } from "@/lib/marketing/nav";

// Ported from mintly-web Footers/SimpleFooter.js: the link columns, the
// company and VAT line, and the G-Cloud and Cyber Essentials badges.
// The copyright year, read once when the page is prerendered.
async function currentYear() {
  "use cache";
  return new Date().getFullYear();
}

export async function SiteFooter() {
  const year = await currentYear();
  return (
    <footer className="bg-brand-navy text-sm text-white/70">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.3fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Image src="/brand/mintly-logo-white.svg" alt="Mintly" width={112} height={56} />
          <p>Bank account validation for UK businesses.</p>
          <p className="flex flex-col items-start">
            <a href={`mailto:${SALES_EMAIL}`} className="py-1.5 text-white hover:text-brand-mint">
              {SALES_EMAIL}
            </a>
            <a href={SUPPORT_PHONE_HREF} className="py-1.5 text-white hover:text-brand-mint">
              {SUPPORT_PHONE}
            </a>
          </p>
          <ul className="flex gap-4">
            {SOCIAL_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} rel="noopener" className="hover:text-brand-mint">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        {footerColumns.map((column) => (
          <div key={column.heading}>
            <h2 className="mb-3 font-semibold text-white">{column.heading}</h2>
            <ul className="space-y-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  {link.external ? (
                    <a href={link.href} rel="noopener" className="hover:text-brand-mint">
                      {link.label}
                    </a>
                  ) : (
                    <Link href={link.href} className="hover:text-brand-mint">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
              {column.heading === "Company" && (
                <li>
                  <ConsentSettingsLink className="hover:text-brand-mint" />
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 text-xs sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p>
              © {year} {COMPANY.legalName}. Registered in England &amp; Wales Company Num.{" "}
              {COMPANY.number}.
            </p>
            <p>Registered for VAT: {COMPANY.vat}</p>
            <p>&quot;Mintly&quot; and the Mintly Leaf are registered trademarks of Mintly Ltd.</p>
            <p>
              * Free trial usage limited with fair usage policy. All paid plans unlimited usage. See
              T&amp;C.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://www.applytosupply.digitalmarketplace.service.gov.uk/g-cloud/services/913977660797705"
              rel="noopener"
              aria-label="Mintly on the G-Cloud framework"
            >
              <Image
                src="/assets/img/theme/CCS_WHITE_Supplier_AW_300dpi.png"
                alt="Crown Commercial Service supplier logo"
                width={140}
                height={112}
                className="h-10 w-auto"
              />
            </a>
            <Image
              src="/assets/img/theme/cyberEssentials-dark.png"
              alt="Cyber Essentials badge"
              width={190}
              height={75}
              className="h-12 w-auto"
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
