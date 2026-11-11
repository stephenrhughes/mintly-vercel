import "server-only";

import { getDeploymentEnvironment } from "@/lib/site";
import { createServiceClient, getServiceKey } from "@/lib/supabase/admin";
import { getSupabaseConfig } from "@/lib/supabase/config";

// Writes from the public forms (ratings, enquiries) go through the service
// role: the tables grant nothing to visitors (plan §4). Without Supabase
// (local development) the row is logged instead.
export async function insertRow(
  table: "tool_ratings" | "enquiries",
  row: Record<string, unknown>,
): Promise<boolean> {
  if (!getSupabaseConfig() || !getServiceKey()) {
    if (getDeploymentEnvironment() === "production") {
      console.error(`Supabase is not configured; a ${table} row was lost.`);
      return false;
    }
    console.info(`[dev] would insert into ${table}`, Object.keys(row));
    return true;
  }
  const { error } = await createServiceClient().from(table).insert(row);
  if (error) {
    console.error(`Inserting into ${table} failed: ${error.message}`);
    return false;
  }
  return true;
}
