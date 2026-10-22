import Image from "next/image";

import { siteConfig } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="bg-brand-navy text-white/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Image src="/brand/mintly-logo-white.svg" alt="Mintly" width={96} height={48} />
          <p>Bank account validation for UK businesses.</p>
        </div>
        <div className="flex flex-col gap-1 md:items-end">
          <a
            href={`mailto:${siteConfig.supportEmail}`}
            className="text-white transition-colors hover:text-brand-mint"
          >
            {siteConfig.supportEmail}
          </a>
          <p>Mintly Ltd. Registered in England and Wales.</p>
        </div>
      </div>
    </footer>
  );
}
