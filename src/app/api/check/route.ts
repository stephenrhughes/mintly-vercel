import { handleCheck } from "@/lib/bank-api/handle";

// POST /api/check: one check from the Tools page (plan §6.2, §8).
export async function POST(request: Request) {
  return handleCheck(request, "single");
}
