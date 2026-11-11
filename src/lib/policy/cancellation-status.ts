import Decimal from "decimal.js";
import type { CancellationPenalties } from "@/lib/etg/types";
import { applyMarkup, type Money } from "@/lib/pricing/money";
import { parseTimestamp } from "./instant";

/** A penalty that starts later, in selling-price terms (markup applied, capped at the total). */
export type PenaltyStep = { start: number; amount: Money };

/**
 * What a rate's cancellation policy means at `now`. The one definition used everywhere: the hotel page's
 * sentence is rendered from it, and the list's "Free cancellation" label and filter are read from it.
 * - `free`: free to cancel, with no stated end.
 * - `free-until`: free until `deadline` (epoch ms); `later` are the penalties after it, lowest first (may be empty).
 * - `penalty-now`: cancelling now costs `amount`, less than the total; `later` are the higher steps to come.
 * - `non-refundable`: cancelling now costs the whole `amount` (the total).
 * - `unknown`: the schedule is empty, contradictory, has a gap at `now`, or cannot be read.
 */
export type CancellationStatus =
  | { kind: "free" }
  | { kind: "free-until"; deadline: number; later: PenaltyStep[] }
  | { kind: "penalty-now"; amount: Money; later: PenaltyStep[] }
  | { kind: "non-refundable"; amount: Money }
  | { kind: "unknown" };

/** Free cancellation, as the list labels and filters it: exactly `free` and `free-until`. */
export function isFreeCancellation(status: CancellationStatus): boolean {
  return status.kind === "free" || status.kind === "free-until";
}

const UNKNOWN: CancellationStatus = { kind: "unknown" };

/**
 * The status, throwing on an unparseable timestamp or an invalid amount (whichever rule would have applied), so
 * the sentence builder can refuse to print bad data. Most callers want `cancellationStatus`, which never throws.
 */
export function classifyCancellation(penalties: CancellationPenalties, total: Money, markupPercent: number, now: Date): CancellationStatus {
  const nowMs = now.getTime();
  const totalDec = new Decimal(total.amount);

  // Validate every timestamp up front so bad data throws whichever rule would have applied.
  const declared = penalties.free_cancellation_before === null ? null : parseTimestamp(penalties.free_cancellation_before);
  const parsed = penalties.policies.map((p) => ({
    p,
    start: p.start_at === null ? -Infinity : parseTimestamp(p.start_at),
    end: p.end_at === null ? Infinity : parseTimestamp(p.end_at),
  }));

  for (const { p } of parsed) {
    let amount: Decimal;
    try {
      amount = new Decimal(p.amount_show);
    } catch {
      throw new Error(`Invalid cancellation amount: ${p.amount_show}`);
    }
    if (!amount.isFinite() || amount.isNegative()) throw new Error(`Invalid cancellation amount: ${p.amount_show}`);
  }

  // A window that ends at or before its own start makes the schedule contradictory.
  if (parsed.some(({ start, end }) => start >= end)) return UNKNOWN;

  // No windows at all: the supplier stated no terms, so nothing can be promised either way.
  if (penalties.policies.length === 0) return UNKNOWN;

  const tiers = parsed
    .map(({ p, start, end }) => {
      const selling = applyMarkup({ amount: p.amount_show, currency: total.currency }, markupPercent);
      const capped = new Decimal(selling.amount).greaterThan(totalDec) ? total : selling;
      const dec = new Decimal(capped.amount);
      return { start, end, amount: capped, dec, isZero: dec.isZero(), atTotal: dec.greaterThanOrEqualTo(totalDec) };
    })
    .sort((a, b) => a.start - b.start);
  type T = (typeof tiers)[number];

  // Overlapping windows are ambiguous; touching at a shared instant is fine.
  for (let i = 0; i < tiers.length - 1; i++) {
    if ((tiers[i] as T).end > (tiers[i + 1] as T).start) return UNKNOWN;
  }

  const currentIdx = tiers.findIndex((t) => t.start <= nowMs && nowMs < t.end);
  if (currentIdx === -1) return UNKNOWN;

  // From now onward the windows must be contiguous and the last one open-ended.
  const fromNow = tiers.slice(currentIdx);
  for (let i = 0; i < fromNow.length - 1; i++) {
    if ((fromNow[i] as T).end !== (fromNow[i + 1] as T).start) return UNKNOWN;
  }
  if ((fromNow[fromNow.length - 1] as T).end !== Infinity) return UNKNOWN;

  // Merge consecutive steps with equal capped penalties, keeping the earliest start.
  const merged: T[] = [];
  for (const t of fromNow) {
    const prev = merged[merged.length - 1];
    if (prev && prev.dec.equals(t.dec)) merged[merged.length - 1] = { ...prev, end: t.end };
    else merged.push(t);
  }
  const current = merged[0] as T;

  if (current.atTotal) return { kind: "non-refundable", amount: total };

  const ahead = merged.slice(1);
  for (let i = 0; i < ahead.length; i++) {
    const prev = i === 0 ? current : (ahead[i - 1] as T);
    if ((ahead[i] as T).dec.lessThan(prev.dec)) return UNKNOWN;
  }
  const later: PenaltyStep[] = ahead.filter((t) => !t.isZero).map((t) => ({ start: t.start, amount: t.amount }));

  if (current.isZero) {
    if (declared !== null && declared <= nowMs) return UNKNOWN;
    if (later.length === 0) return declared === null ? { kind: "free" } : { kind: "free-until", deadline: declared, later };
    const firstStart = (later[0] as PenaltyStep).start;
    return { kind: "free-until", deadline: declared !== null ? Math.min(declared, firstStart) : firstStart, later };
  }

  return { kind: "penalty-now", amount: current.amount, later };
}

/** The status, never throwing: anything unreadable is `unknown`. */
export function cancellationStatus(penalties: CancellationPenalties, total: Money, markupPercent: number, now: Date): CancellationStatus {
  try {
    return classifyCancellation(penalties, total, markupPercent, now);
  } catch {
    return UNKNOWN;
  }
}
