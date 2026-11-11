import Decimal from "decimal.js";
import type { CancellationPenalties } from "@/lib/etg/types";
import { applyMarkup, formatMoney, type Money } from "@/lib/pricing/money";
import { formatWhen, parseTimestamp } from "./instant";

/** The body of "Full cancellation policy" when there is nothing we can show. Rendered when the lines are empty. */
export const POLICY_LINES_FALLBACK = "The hotel did not provide cancellation terms we can display. Ask us before you book.";

/**
 * The full structured policy, one line per window in time order, as the supplier sent it: overlaps and gaps are
 * listed, not judged (the sentence does that). Amounts are in selling-price terms (markup applied, capped at the
 * total, as in the sentence); instants are shown in the hotel's zone and name it. The supplier's own
 * free-cancellation deadline, if any, comes last. Returns [] when the list is empty or anything in it cannot be
 * read; the page then shows POLICY_LINES_FALLBACK. Never throws.
 */
export function policyLines(input: { penalties: CancellationPenalties; total: Money; markupPercent: number; timeZone: string; now: Date }): string[] {
  try {
    return build(input);
  } catch {
    return [];
  }
}

function build({ penalties, total, markupPercent, timeZone, now }: Parameters<typeof policyLines>[0]): string[] {
  if (penalties.policies.length === 0) return [];
  const totalDec = new Decimal(total.amount);
  const when = (ms: number) => formatWhen(ms, now, timeZone);

  const declared = penalties.free_cancellation_before === null ? null : parseTimestamp(penalties.free_cancellation_before);
  const windows = penalties.policies.map((p) => {
    const raw = new Decimal(p.amount_show); // throws on text that is not a number
    if (!raw.isFinite() || raw.isNegative()) throw new Error(`Invalid cancellation amount: ${p.amount_show}`);
    const selling = applyMarkup({ amount: p.amount_show, currency: total.currency }, markupPercent);
    const amount = new Decimal(selling.amount).greaterThan(totalDec) ? total : selling;
    return {
      start: p.start_at === null ? null : parseTimestamp(p.start_at),
      end: p.end_at === null ? null : parseTimestamp(p.end_at),
      amount,
      isZero: new Decimal(amount.amount).isZero(),
    };
  });

  // Time order: by start (none first), then by end (none last). Array.prototype.sort is stable for full ties.
  const cmp = (x: number, y: number) => (x < y ? -1 : x > y ? 1 : 0);
  windows.sort((a, b) => cmp(a.start ?? -Infinity, b.start ?? -Infinity) || cmp(a.end ?? Infinity, b.end ?? Infinity));

  const lines = windows.map((w) => {
    if (w.isZero) {
      if (w.end !== null) return `Until ${when(w.end)}: free`;
      return w.start === null ? "At any time: free" : `From ${when(w.start)}: free`;
    }
    const lose = `you lose ${formatMoney(w.amount)}`;
    if (w.start !== null) return `From ${when(w.start)}: ${lose}`;
    return w.end === null ? `At any time: ${lose}` : `Until ${when(w.end)}: ${lose}`;
  });
  if (declared !== null) lines.push(`Free cancellation deadline stated by the hotel: ${when(declared)}`);
  return lines;
}
