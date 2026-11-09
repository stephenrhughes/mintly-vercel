import { connection } from "next/server";

import { UsageSyncAlertEmail, usageSyncAlertSubject } from "@/emails/usage-sync-alert";
import { isCronRequest } from "@/lib/cron";
import { adminNotifyEmail, sendEmail } from "@/lib/email/send";
import { getDeploymentEnvironment } from "@/lib/site";
import { alertReason, runUsageSync } from "@/lib/usage/sync";
import { usageSyncDeps } from "@/lib/usage/sync-server";

// The nightly usage sync (plan §6.4, §8, vercel.json): copies the last few
// days of each key's usage from DynamoDB into usage_daily, backfilling two
// years for keys seen for the first time, and deletes check_log rows past
// their retention (plan §13.4). Admins are emailed if it fails or, on
// production, finds no data at all (plan §9).

export const maxDuration = 300;

export async function GET(request: Request) {
  await connection();
  if (!isCronRequest(request)) return Response.json({ error: "Unauthorised" }, { status: 401 });

  let result;
  try {
    result = await runUsageSync(usageSyncDeps());
  } catch (error) {
    result = {
      keys: 0,
      enabledKeys: 0,
      backfilled: 0,
      rows: 0,
      purgedChecks: 0,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }

  const reason = alertReason(result, getDeploymentEnvironment() === "production");
  if (reason) {
    try {
      await sendEmail({
        to: adminNotifyEmail(),
        subject: usageSyncAlertSubject,
        react: UsageSyncAlertEmail({ reason, details: result.errors }),
      });
    } catch (error) {
      console.error("sending the usage sync alert failed", error);
    }
  }

  console.info(JSON.stringify({ msg: "cron usage-sync", ...result, alert: reason }));
  return Response.json(result, { status: result.errors.length > 0 ? 500 : 200 });
}
