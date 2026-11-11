import type { CancellationPenalties } from "@/lib/etg/schemas";
import { formatMoney, type Money } from "@/lib/pricing/money";
import { classifyCancellation, type PenaltyStep } from "./cancellation-status";
import { formatDate, formatWhen } from "./instant";

/** Shown when the policy cannot be summed up in one sentence (status `unknown`); the full policy sits under it. */
export const CANCELLATION_FALLBACK = "See the full cancellation policy for this rate.";

/**
 * One plain-English sentence, rendered from `classifyCancellation`, so it always agrees with the status the list
 * uses. Throws on an unparseable timestamp or amount, so bad data is never printed.
 */
export function cancellationSentence(input: {
  penalties: CancellationPenalties;
  total: Money;
  markupPercent: number;
  timeZone: string;
  now: Date;
}): string {
  const { penalties, total, markupPercent, timeZone, now } = input;
  const status = classifyCancellation(penalties, total, markupPercent, now);
  const when = (ms: number) => formatWhen(ms, now, timeZone);
  const date = (ms: number) => formatDate(ms, now, timeZone);

  switch (status.kind) {
    case "unknown":
      return CANCELLATION_FALLBACK;
    case "non-refundable":
      return `Non-refundable. If you cancel you lose ${formatMoney(status.amount)}.`;
    case "free":
      return "Free to cancel.";
    case "free-until": {
      const head = `Free to cancel until ${when(status.deadline)}.`;
      const { later } = status;
      if (later.length === 0) return head;
      const first = later[0] as PenaltyStep;
      const last = later[later.length - 1] as PenaltyStep;
      if (later.length === 1) return `${head} After that you lose ${formatMoney(first.amount)}.`;
      if (later.length === 2) return `${head} After that you lose ${formatMoney(first.amount)}, rising to ${formatMoney(last.amount)} from ${date(last.start)}.`;
      return `${head} After that you lose ${formatMoney(first.amount)}, rising in steps to ${formatMoney(last.amount)} by ${date(last.start)}.`;
    }
    case "penalty-now": {
      let out = `If you cancel now you lose ${formatMoney(status.amount)}.`;
      const { later } = status;
      if (later.length > 0) {
        const first = later[0] as PenaltyStep;
        const last = later[later.length - 1] as PenaltyStep;
        out += ` From ${when(first.start)} you lose ${formatMoney(first.amount)}`;
        out += later.length === 1 ? "." : `, rising in steps to ${formatMoney(last.amount)} by ${date(last.start)}.`;
      }
      return out;
    }
  }
}
