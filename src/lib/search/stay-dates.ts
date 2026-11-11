/**
 * Stay dates are calendar days, not instants. Between the server and the browser they travel only as
 * "YYYY-MM-DD" strings: a `Date` would be serialised as a UTC instant and land on the previous day for a
 * visitor west of the server's zone. Each side builds its own local calendar date from the string's parts.
 */

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "YYYY-MM-DD" that is a real calendar date, else null. Never parses through `new Date(string)` (that reads it as UTC). */
export function isoToLocalDate(s: string | null | undefined): Date | null {
  const m = s ? ISO_DAY.exec(s) : null;
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  // Reject what the Date constructor rolls over (31 February), and two-digit years it maps to 19xx.
  date.setFullYear(y);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date : null;
}

/** The local calendar day of `d` as "YYYY-MM-DD", from its local parts. */
export function localDateToIso(d: Date): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A pair of stay-date strings as local calendar dates, or undefined when either is unusable. */
export function isoRangeToLocal(range: { from: string; to: string } | undefined): { from: Date; to: Date } | undefined {
  const from = isoToLocalDate(range?.from);
  const to = isoToLocalDate(range?.to);
  return from && to ? { from, to } : undefined;
}
