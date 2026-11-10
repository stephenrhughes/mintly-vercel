// Team seat limits (TEAM-03, PROV-09), ported from mintly-web
// amplify/shared/seats.cjs. A subscription's seat limit is the seats its
// price includes (the price's maxTeamSize metadata) plus any extra users an
// admin granted on the subscription (PLAN-11). The owner takes one of them.

/** A positive whole number of seats, or undefined. */
export function parseSeats(value: unknown): number | undefined {
  const seats = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(seats) && seats > 0 ? seats : undefined;
}

/**
 * The most people the team may hold, owner included, or null when the price
 * has no maxTeamSize metadata and the limit is unknown.
 */
export function seatLimit({
  maxTeamSize,
  extraUsers,
}: {
  maxTeamSize: unknown;
  extraUsers?: unknown;
}): number | null {
  const included = parseSeats(maxTeamSize);
  if (!included) return null;
  return included + (Number.parseInt(String(extraUsers ?? 0), 10) || 0);
}

export function teamFullMessage(used: number, limit: number): string {
  return `Your team is full (${used} of ${limit} seats used). Remove a member or withdraw an invite, or contact us to add seats.`;
}
