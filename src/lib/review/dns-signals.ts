import "server-only";

import { Resolver } from "node:dns/promises";

// Whether an email domain has mail (MX) records and a website, for the
// review queue (APPR-04). DNS only: the app never fetches a URL the
// customer chose, so this can't be used to reach internal hosts.

export type DnsSignals = { mx: boolean | null; website: boolean | null };

const TIMEOUT_MS = 2500;

async function resolves(task: () => Promise<unknown[]>): Promise<boolean | null> {
  try {
    const result = await Promise.race([
      task(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)),
    ]);
    return result.length > 0;
  } catch (error) {
    const code = (error as { code?: string }).code;
    // No such records is an answer; anything else (a timeout) is unknown.
    return code === "ENOTFOUND" || code === "ENODATA" ? false : null;
  }
}

export async function dnsSignals(domain: string): Promise<DnsSignals> {
  const resolver = new Resolver({ timeout: TIMEOUT_MS, tries: 1 });
  const [mx, apex, www] = await Promise.all([
    resolves(() => resolver.resolveMx(domain)),
    resolves(() => resolver.resolve4(domain)),
    resolves(() => resolver.resolve4(`www.${domain}`)),
  ]);
  const website =
    apex === true || www === true ? true : apex === null || www === null ? null : false;
  return { mx, website };
}
