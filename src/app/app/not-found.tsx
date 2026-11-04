import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { appPath } from "@/lib/hosts";

export default function AppNotFound() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 bg-muted px-4 py-24 text-center">
      <Image src="/brand/mintly-logo.svg" alt="Mintly" width={104} height={52} />
      <div>
        <p className="text-sm font-medium text-primary">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-muted-foreground">
          There&apos;s no page at this address in the app.
        </p>
      </div>
      <Button asChild>
        <Link href={appPath("/")}>Go to Overview</Link>
      </Button>
    </div>
  );
}
