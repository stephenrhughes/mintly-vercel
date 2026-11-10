import { handleCheck } from "@/lib/bank-api/handle";

// POST /api/check/batch: up to 25 lines of a bulk check, paced to the
// plan's throttle (plan §6.2, TOOL-09). 25 × 500 ms fits well within this.
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleCheck(request, "bulk");
}
