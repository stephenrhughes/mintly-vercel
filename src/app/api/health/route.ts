import { connection } from "next/server";

import { getDeploymentEnvironment } from "@/lib/site";

// Liveness check for uptime monitors and the post-deploy smoke test.
export async function GET() {
  await connection();

  return Response.json(
    {
      status: "ok",
      environment: getDeploymentEnvironment(),
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      region: process.env.VERCEL_REGION ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
