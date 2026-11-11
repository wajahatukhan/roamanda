import { describe, expect, test } from "vitest";
import type { CancellationPenalties } from "@/lib/etg/types";
import { CANCELLATION_FALLBACK, cancellationSentence } from "@/lib/policy/cancellation-sentence";

type PolicyIn = { start_at: string | null; end_at: string | null; amount_show: string; amount_charge?: string };
type PenaltiesIn = { free_cancellation_before: string | null; policies: PolicyIn[] };
type Overrides = { now?: Date; timeZone?: string; markupPercent?: number };

const NOW = new Date("2026-06-01T00:00:00Z");

function s(penalties: PenaltiesIn, o: Overrides = {}): string {
  const full: CancellationPenalties = {
    free_cancellation_before: penalties.free_cancellation_before,
    policies: penalties.policies.map((p) => ({ ...p, amount_charge: p.amount_charge ?? p.amount_show })),
  };
  return cancellationSentence({
    penalties: full,
    total: { amount: "200.00", currency: "USD" },
    markupPercent: o.markupPercent ?? 10,
    timeZone: o.timeZone ?? "Asia/Dubai",
    now: o.now ?? NOW,
  });
}

const freeThenFull: PenaltiesIn = {
  free_cancellation_before: "2026-06-27T19:59:00",
  policies: [
    { start_at: null, end_at: "2026-06-27T19:59:00", amount_show: "0.00" },
    { start_at: "2026-06-27T19:59:00", end_at: null, amount_show: "181.82" },
  ],
};

describe("cancellationSentence", () => {
  test("free then full penalty", () => {
    expect(s(freeThenFull)).toBe("Free to cancel until 27 June, 11:59 pm Dubai time. After that you lose $200.00.");
  });
  test("non-refundable", () => {
    expect(s({ free_cancellation_before: null, policies: [{ start_at: null, end_at: null, amount_show: "181.82" }] })).toBe(
      "Non-refundable. If you cancel you lose $200.00.",
    );
  });
  test("no policies is treated as non-refundable", () => {
    expect(s({ free_cancellation_before: null, policies: [] })).toBe("Non-refundable. If you cancel you lose $200.00.");
  });
  test("deadline already passed never prints a past date", () => {
    expect(s(freeThenFull, { now: new Date("2026-06-28T00:00:00Z") })).toBe("Non-refundable. If you cancel you lose $200.00.");
  });
  test("partial penalty now, full later", () => {
    expect(
      s({
        free_cancellation_before: null,
        policies: [
          { start_at: null, end_at: "2026-07-01T20:00:00", amount_show: "50.00" },
          { start_at: "2026-07-01T20:00:00", end_at: null, amount_show: "181.82" },
        ],
      }),
    ).toBe("If you cancel now you lose $55.00. From 2 July, 12:00 am Dubai time you lose $200.00.");
  });
  test("partial penalty now, nothing later", () => {
    expect(s({ free_cancellation_before: null, policies: [{ start_at: null, end_at: null, amount_show: "50.00" }] })).toBe(
      "If you cancel now you lose $55.00.",
    );
  });
  test("several later tiers", () => {
    expect(
      s({
        free_cancellation_before: "2026-06-10T20:00:00",
        policies: [
          { start_at: null, end_at: "2026-06-10T20:00:00", amount_show: "0.00" },
          { start_at: "2026-06-10T20:00:00", end_at: "2026-06-20T20:00:00", amount_show: "50.00" },
          { start_at: "2026-06-20T20:00:00", end_at: null, amount_show: "181.82" },
        ],
      }),
    ).toBe("Free to cancel until 11 June, 12:00 am Dubai time. After that you lose $55.00, rising to $200.00 from 21 June.");
  });
  test("deadline falls back to the first later start when free_cancellation_before is null", () => {
    expect(
      s({
        free_cancellation_before: null,
        policies: [
          { start_at: null, end_at: "2026-06-27T19:59:00", amount_show: "0.00" },
          { start_at: "2026-06-27T19:59:00", end_at: null, amount_show: "181.82" },
        ],
      }),
    ).toBe("Free to cancel until 27 June, 11:59 pm Dubai time. After that you lose $200.00.");
  });
  test("penalty is capped at the total", () => {
    expect(s({ free_cancellation_before: null, policies: [{ start_at: null, end_at: null, amount_show: "500.00" }] })).toBe(
      "Non-refundable. If you cancel you lose $200.00.",
    );
    expect(
      s({
        free_cancellation_before: "2026-06-27T19:59:00",
        policies: [
          { start_at: null, end_at: "2026-06-27T19:59:00", amount_show: "0.00" },
          { start_at: "2026-06-27T19:59:00", end_at: null, amount_show: "500.00" },
        ],
      }),
    ).toBe("Free to cancel until 27 June, 11:59 pm Dubai time. After that you lose $200.00.");
  });
  test("year shown when it differs", () => {
    expect(
      s({
        free_cancellation_before: "2027-01-05T10:00:00",
        policies: [
          { start_at: null, end_at: "2027-01-05T10:00:00", amount_show: "0.00" },
          { start_at: "2027-01-05T10:00:00", end_at: null, amount_show: "181.82" },
        ],
      }),
    ).toBe("Free to cancel until 5 January 2027, 2:00 pm Dubai time. After that you lose $200.00.");
  });
  test("timestamp carrying Z or an offset is parsed as given", () => {
    expect(
      s({
        free_cancellation_before: "2026-06-27T23:59:00+04:00",
        policies: [
          { start_at: null, end_at: "2026-06-27T19:59:00Z", amount_show: "0.00" },
          { start_at: "2026-06-27T19:59:00Z", end_at: null, amount_show: "181.82" },
        ],
      }),
    ).toBe("Free to cancel until 27 June, 11:59 pm Dubai time. After that you lose $200.00.");
  });
  test("policy order in the input does not matter", () => {
    const tiers: PenaltiesIn = {
      free_cancellation_before: "2026-06-10T20:00:00",
      policies: [
        { start_at: null, end_at: "2026-06-10T20:00:00", amount_show: "0.00" },
        { start_at: "2026-06-10T20:00:00", end_at: "2026-06-20T20:00:00", amount_show: "50.00" },
        { start_at: "2026-06-20T20:00:00", end_at: null, amount_show: "181.82" },
      ],
    };
    const shuffled = { ...tiers, policies: [...tiers.policies].reverse() };
    expect(s(shuffled)).toBe(s(tiers));
  });
  test("an unparseable timestamp throws instead of printing Invalid Date", () => {
    expect(() =>
      s({
        free_cancellation_before: "not-a-date",
        policies: [
          { start_at: null, end_at: "not-a-date", amount_show: "0.00" },
          { start_at: "not-a-date", end_at: null, amount_show: "181.82" },
        ],
      }),
    ).toThrow(/timestamp/i);
  });
  test("fully free window that ends with nothing after it falls back", () => {
    expect(s({ free_cancellation_before: null, policies: [{ start_at: null, end_at: "2026-07-01T00:00:00", amount_show: "0.00" }] })).toBe(
      CANCELLATION_FALLBACK,
    );
  });
  test("overlapping windows fall back (same window)", () => {
    expect(
      s({
        free_cancellation_before: null,
        policies: [
          { start_at: null, end_at: null, amount_show: "0.00" },
          { start_at: null, end_at: null, amount_show: "181.82" },
        ],
      }),
    ).toBe(CANCELLATION_FALLBACK);
  });
  test("overlapping windows fall back (late-starting penalty overlaps free)", () => {
    expect(
      s({
        free_cancellation_before: null,
        policies: [
          { start_at: null, end_at: "2026-06-27T00:00:00", amount_show: "0.00" },
          { start_at: "2026-05-01T00:00:00", end_at: null, amount_show: "181.82" },
        ],
      }),
    ).toBe(CANCELLATION_FALLBACK);
  });
  test("middle steps are not dropped (partial now, three tiers)", () => {
    expect(
      s({
        free_cancellation_before: null,
        policies: [
          { start_at: null, end_at: "2026-07-01T20:00:00", amount_show: "50.00" },
          { start_at: "2026-07-01T20:00:00", end_at: "2026-07-05T20:00:00", amount_show: "100.00" },
          { start_at: "2026-07-05T20:00:00", end_at: null, amount_show: "181.82" },
        ],
      }),
    ).toBe("If you cancel now you lose $55.00. From 2 July, 12:00 am Dubai time you lose $110.00, rising in steps to $200.00 by 6 July.");
  });
  test("middle steps are not dropped (free, three later tiers)", () => {
    expect(
      s({
        free_cancellation_before: "2026-06-10T20:00:00",
        policies: [
          { start_at: null, end_at: "2026-06-10T20:00:00", amount_show: "0.00" },
          { start_at: "2026-06-10T20:00:00", end_at: "2026-06-15T20:00:00", amount_show: "50.00" },
          { start_at: "2026-06-15T20:00:00", end_at: "2026-06-20T20:00:00", amount_show: "100.00" },
          { start_at: "2026-06-20T20:00:00", end_at: null, amount_show: "181.82" },
        ],
      }),
    ).toBe("Free to cancel until 11 June, 12:00 am Dubai time. After that you lose $55.00, rising in steps to $200.00 by 21 June.");
  });
  test("penalties that decrease over time fall back", () => {
    expect(
      s({
        free_cancellation_before: null,
        policies: [
          { start_at: null, end_at: "2026-07-01T00:00:00", amount_show: "100.00" },
          { start_at: "2026-07-01T00:00:00", end_at: null, amount_show: "50.00" },
        ],
      }),
    ).toBe(CANCELLATION_FALLBACK);
  });
  test("deadline is the earlier of free_cancellation_before and the first penalty start", () => {
    expect(
      s({
        free_cancellation_before: "2026-06-28T19:59:00",
        policies: [
          { start_at: null, end_at: "2026-06-27T19:59:00", amount_show: "0.00" },
          { start_at: "2026-06-27T19:59:00", end_at: null, amount_show: "181.82" },
        ],
      }),
    ).toBe("Free to cancel until 27 June, 11:59 pm Dubai time. After that you lose $200.00.");
  });
  test("garbage free_cancellation_before throws even when unused", () => {
    expect(() =>
      s({ free_cancellation_before: "garbage", policies: [{ start_at: null, end_at: null, amount_show: "181.82" }] }),
    ).toThrow(/timestamp/i);
  });
  test("impossible calendar dates throw", () => {
    expect(() =>
      s({ free_cancellation_before: "2026-02-30T10:00:00", policies: [{ start_at: null, end_at: null, amount_show: "181.82" }] }),
    ).toThrow(/timestamp/i);
  });
  test("current penalty at total is non-refundable even with later tiers", () => {
    expect(
      s({
        free_cancellation_before: null,
        policies: [
          { start_at: null, end_at: "2026-07-01T20:00:00", amount_show: "181.82" },
          { start_at: "2026-07-01T20:00:00", end_at: null, amount_show: "500.00" },
        ],
      }),
    ).toBe("Non-refundable. If you cancel you lose $200.00.");
  });
  test("fully free rate", () => {
    expect(s({ free_cancellation_before: null, policies: [{ start_at: null, end_at: null, amount_show: "0.00" }] })).toBe(
      "Free to cancel.",
    );
  });
  test("past free_cancellation_before falls back to the first later start", () => {
    expect(
      s({
        free_cancellation_before: "2026-05-01T10:00:00",
        policies: [
          { start_at: null, end_at: "2026-06-27T19:59:00", amount_show: "0.00" },
          { start_at: "2026-06-27T19:59:00", end_at: null, amount_show: "181.82" },
        ],
      }),
    ).toBe("Free to cancel until 27 June, 11:59 pm Dubai time. After that you lose $200.00.");
  });
  test("a gap at now returns the fallback copy", () => {
    expect(
      s({ free_cancellation_before: null, policies: [{ start_at: "2026-06-10T00:00:00", end_at: null, amount_show: "0.00" }] }),
    ).toBe(CANCELLATION_FALLBACK);
    expect(CANCELLATION_FALLBACK).toBe("See the full cancellation policy for this rate.");
  });
});
