import type { SupabaseClient } from "@supabase/supabase-js";

// The admin audit log (plan §4, §6.8, ADM-07). Every admin write, every
// view-as session and every key rotation is recorded in admin_audit, which
// only the service role can insert into and only admins can read.

export type AuditInput = {
  /** The admin (or customer, for key rotation); null means the system. */
  actorId: string | null;
  orgId: string | null;
  action: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  details?: Record<string, unknown>;
};

/** Writes one audit entry. Admin operations take one of these so tests can record them. */
export type AuditSink = (entry: AuditInput) => Promise<void>;

export async function recordAudit(db: SupabaseClient, input: AuditInput): Promise<void> {
  const { error } = await db.from("admin_audit").insert({
    actor_id: input.actorId,
    target_org_id: input.orgId,
    action: input.action,
    before: input.before ?? null,
    after: input.after ?? null,
    details: input.details ?? {},
  });
  if (error) throw new Error(`writing the audit entry failed: ${error.message}`);
}

export function auditSink(db: SupabaseClient): AuditSink {
  return (entry) => recordAudit(db, entry);
}

/** An error's message, for audit details and admin-facing errors. */
export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Collects audit entries in memory, for tests. */
export function memoryAudit(): AuditSink & { entries: AuditInput[] } {
  const entries: AuditInput[] = [];
  const sink = (async (entry: AuditInput) => {
    entries.push(entry);
  }) as AuditSink & { entries: AuditInput[] };
  sink.entries = entries;
  return sink;
}
