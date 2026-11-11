import Decimal from "decimal.js";
import type { CancellationPenalties } from "@/lib/etg/types";
import { applyMarkup, formatMoney, type Money } from "@/lib/pricing/money";
import { zoneLabel } from "./time-zone";

/** Shown when the policy windows leave a gap at `now`; page code may reuse it. */
export const CANCELLATION_FALLBACK = "See the full cancellation policy for this rate.";

type Tier = { start: number; amount: Money; isZero: boolean; atTotal: boolean };

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

/** ETG timestamps carry no offset and are UTC. Throws on anything unparseable. */
function parseTimestamp(value: string): number {
  if (!ISO.test(value)) throw new Error(`Unparseable cancellation timestamp: ${value}`);
  let v = value;
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(v)) v += "Z";
  else v = v.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const ms = Date.parse(v);
  if (Number.isNaN(ms)) throw new Error(`Unparseable cancellation timestamp: ${value}`);
  return ms;
}

function zoneParts(ms: number, timeZone: string, options: Intl.DateTimeFormatOptions, locale: string) {
  const parts = new Intl.DateTimeFormat(locale, { timeZone, ...options }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return get;
}

function formatDate(ms: number, now: Date, timeZone: string): string {
  const d = zoneParts(ms, timeZone, { day: "numeric", month: "long", year: "numeric" }, "en-GB");
  const nowYear = zoneParts(now.getTime(), timeZone, { year: "numeric" }, "en-GB")("year");
  const base = `${d("day")} ${d("month")}`;
  return d("year") === nowYear ? base : `${base} ${d("year")}`;
}

function formatTime(ms: number, timeZone: string): string {
  const t = zoneParts(ms, timeZone, { hour: "numeric", minute: "2-digit", hourCycle: "h12" }, "en-US");
  return `${t("hour")}:${t("minute")} ${t("dayPeriod").toLowerCase()}`;
}

export function cancellationSentence(input: {
  penalties: CancellationPenalties;
  total: Money;
  markupPercent: number;
  timeZone: string;
  now: Date;
}): string {
  const { penalties, total, markupPercent, timeZone, now } = input;
  const nowMs = now.getTime();
  const totalDec = new Decimal(total.amount);
  const money = (m: Money) => formatMoney(m);
  const nonRefundable = `Non-refundable. If you cancel you lose ${money(total)}.`;

  if (penalties.policies.length === 0) return nonRefundable;

  const tiers = penalties.policies
    .map((p) => {
      const selling = applyMarkup({ amount: p.amount_show, currency: total.currency }, markupPercent);
      const sellingDec = new Decimal(selling.amount);
      const capped = sellingDec.greaterThan(totalDec) ? total : selling;
      const dec = new Decimal(capped.amount);
      return {
        start: p.start_at === null ? -Infinity : parseTimestamp(p.start_at),
        end: p.end_at === null ? Infinity : parseTimestamp(p.end_at),
        amount: capped,
        isZero: dec.isZero(),
        atTotal: dec.greaterThanOrEqualTo(totalDec),
      };
    })
    .sort((a, b) => a.start - b.start);

  const current = tiers.find((t) => t.start <= nowMs && nowMs < t.end);
  const later = tiers.filter((t) => t.start > nowMs && !t.isZero);
  if (!current) return CANCELLATION_FALLBACK;

  if (current.atTotal && later.length === 0) return nonRefundable;

  const when = (ms: number) => `${formatDate(ms, now, timeZone)}, ${formatTime(ms, timeZone)} ${zoneLabel(timeZone)}`;

  if (current.isZero) {
    if (later.length === 0) return "Free to cancel.";
    const declared = penalties.free_cancellation_before === null ? null : parseTimestamp(penalties.free_cancellation_before);
    const deadline = declared !== null && declared > nowMs ? declared : (later[0] as Tier).start;
    const head = `Free to cancel until ${when(deadline)}.`;
    if (later.length === 1) return `${head} After that you lose ${money((later[0] as Tier).amount)}.`;
    const first = later[0] as Tier;
    const last = later[later.length - 1] as Tier;
    return `${head} After that you lose ${money(first.amount)}, rising to ${money(last.amount)} from ${formatDate(last.start, now, timeZone)}.`;
  }

  let out = `If you cancel now you lose ${money(current.amount)}.`;
  if (later.length > 0) {
    const last = later[later.length - 1] as Tier;
    out += ` From ${when(last.start)} you lose ${money(last.amount)}.`;
  }
  return out;
}
