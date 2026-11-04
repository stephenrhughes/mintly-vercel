import Image from "next/image";

import { salesHomeUrl } from "@/lib/auth/urls";

// The auth layout (LAY-01, LAY-06): a plain centred card with the logo, and
// one link back to the sales site.
export default function AuthLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted">
      <header className="flex items-center justify-between px-4 py-5 sm:px-8">
        <Image src="/brand/mintly-logo.svg" alt="Mintly" width={104} height={52} priority />
        <a
          href={salesHomeUrl()}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Back to mintly.uk
        </a>
      </header>
      <main
        id="content"
        className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:pt-12"
      >
        {children}
      </main>
    </div>
  );
}
