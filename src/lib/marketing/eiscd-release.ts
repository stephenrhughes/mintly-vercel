// New EISCD files are published every Friday (plan §6.7), so the release
// notes show the most recent Friday as the current EISCD version, as the
// old page did (previousFriday of tomorrow).

/** The most recent Friday, or today if today is a Friday (UTC). */
export function latestEiscdRelease(today: Date): Date {
  const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() - 5 + 7) % 7));
  return date;
}
