/**
 * "23 September 2026": the date a downloaded pack or Bible was made, as a person reads it
 * (never a raw ISO timestamp). UTC, so the same moment reads the same on every server.
 */
export function formatPackDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    date,
  );
}
