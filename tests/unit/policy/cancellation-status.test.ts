import { describe, expect, it } from "vitest";
import type { Rate } from "@/lib/etg/schemas";
import { Rate as RateSchema } from "@/lib/etg/schemas";
import type { Hotel } from "@/lib/content/types";
import type { CancellationPenalties } from "@/lib/etg/types";
import { buildRateRows } from "@/lib/hotel/rate-rows";
import { CANCELLATION_FALLBACK, cancellationSentence } from "@/lib/policy/cancellation-sentence";
import { cancellationStatus, isFreeCancellation } from "@/lib/policy/cancellation-status";
import { buildList } from "@/lib/search/list";
import hp10004834 from "../../fixtures/etg/hp-10004834.json";
import hp8819557 from "../../fixtures/etg/hp-8819557.json";

const NOW = new Date("2026-11-11T00:00:00Z");
const MARKUP = 12;
const TOTAL = { amount: "224.00", currency: "USD" }; // 200.00 net at 12%

function rate(penalties: CancellationPenalties, amount = "200.00"): Rate {
  return {
    book_hash: "h-1",
    search_hash: null,
    room_name: "Room",
    room_data_trans: { main_name: "Room", bedding_type: null, misc_room_type: null },
    meal_data: { value: "nomeal", has_breakfast: false },
    amenities_data: [],
    payment_options: {
      payment_types: [{ amount, currency_code: "USD", show_amount: amount, show_currency_code: "USD", type: "deposit", tax_data: { taxes: [] }, cancellation_penalties: penalties }],
    },
  };
}

const hotel: Hotel = {
  hid: 1, name: "Hotel", address: null, latitude: null, longitude: null, starRating: null, kind: null, regionId: null, regionName: null, countryCode: null,
  timeZone: "UTC", checkInTime: null, checkOutTime: null, images: [], amenityGroups: [], description: [], metapolicyStruct: null, metapolicyExtraInfo: null,
  reviewRating: null, reviewDetailed: null, syncedAt: "2026-11-11T00:00:00.000Z",
};

/** What the list says (label, and whether the free-cancellation filter keeps it) and what the hotel page says. */
function both(penalties: CancellationPenalties) {
  const ctx = { markupPercent: MARKUP, taxNames: {}, now: NOW, currency: "USD" };
  const listed = buildList([{ hid: 1, rates: [rate(penalties)] }], new Map([[1, hotel]]), ctx);
  const filtered = buildList([{ hid: 1, rates: [rate(penalties)] }], new Map([[1, hotel]]), ctx, { freeCancellation: true });
  const [row] = buildRateRows([rate(penalties)], { ...ctx, timeZone: "UTC", mealNames: {} });
  return { label: listed.items[0]!.freeCancellation, keptByFilter: filtered.items.length === 1, sentence: row!.cancellation };
}

const p = (start_at: string | null, end_at: string | null, amount: string) => ({ start_at, end_at, amount_charge: amount, amount_show: amount });

describe("the list and the hotel page agree (the three cases that used to disagree)", () => {
  it("a future deadline with a paid current window: no label, and the sentence states the penalty now", () => {
    const r = both({ free_cancellation_before: "2026-12-10T00:00:00", policies: [p(null, null, "50.00")] });
    expect(r.sentence).toBe("If you cancel now you lose $56.00.");
    expect(r.label).toBe(false);
    expect(r.keptByFilter).toBe(false);
  });

  it("a future deadline with broken windows: no label, and the sentence is the fallback", () => {
    // Overlapping windows (a penalty starts before the free window ends).
    const r = both({ free_cancellation_before: "2026-12-10T00:00:00", policies: [p(null, "2026-12-10T00:00:00", "0.00"), p("2026-12-01T00:00:00", null, "200.00")] });
    expect(r.sentence).toBe(CANCELLATION_FALLBACK);
    expect(r.label).toBe(false);
    expect(r.keptByFilter).toBe(false);
  });

  it("no deadline but free-then-paid windows: labelled free, kept by the filter, and the sentence says free until", () => {
    const r = both({ free_cancellation_before: null, policies: [p(null, "2026-12-01T12:00:00", "0.00"), p("2026-12-01T12:00:00", null, "200.00")] });
    expect(r.sentence).toBe("Free to cancel until 1 December, 12:00 pm UTC. After that you lose $224.00.");
    expect(r.label).toBe(true);
    expect(r.keptByFilter).toBe(true);
  });
});

describe("cancellationStatus", () => {
  const status = (penalties: CancellationPenalties) => cancellationStatus(penalties, TOTAL, MARKUP, NOW);

  it("names each kind", () => {
    expect(status({ free_cancellation_before: null, policies: [p(null, null, "0.00")] })).toEqual({ kind: "free" });
    expect(status({ free_cancellation_before: "2026-12-10T00:00:00", policies: [p(null, null, "0.00")] })).toEqual({ kind: "free-until", deadline: Date.parse("2026-12-10T00:00:00Z"), later: [] });
    expect(status({ free_cancellation_before: null, policies: [p(null, "2026-12-01T00:00:00", "0.00"), p("2026-12-01T00:00:00", null, "100.00")] })).toEqual({
      kind: "free-until",
      deadline: Date.parse("2026-12-01T00:00:00Z"),
      later: [{ start: Date.parse("2026-12-01T00:00:00Z"), amount: { amount: "112.00", currency: "USD" } }],
    });
    expect(status({ free_cancellation_before: null, policies: [p(null, null, "50.00")] })).toEqual({ kind: "penalty-now", amount: { amount: "56.00", currency: "USD" }, later: [] });
    expect(status({ free_cancellation_before: null, policies: [p(null, null, "200.00")] })).toEqual({ kind: "non-refundable", amount: TOTAL });
  });

  it("is unknown for an empty schedule, a gap at now, or anything unreadable, and never throws", () => {
    expect(status({ free_cancellation_before: null, policies: [] })).toEqual({ kind: "unknown" });
    expect(status({ free_cancellation_before: "2026-12-10T00:00:00", policies: [] })).toEqual({ kind: "unknown" });
    expect(status({ free_cancellation_before: null, policies: [p("2026-12-01T00:00:00", null, "0.00")] })).toEqual({ kind: "unknown" });
    expect(status({ free_cancellation_before: "not-a-date", policies: [p(null, null, "0.00")] })).toEqual({ kind: "unknown" });
    expect(status({ free_cancellation_before: null, policies: [p(null, null, "-1.00")] })).toEqual({ kind: "unknown" });
  });

  it("counts free and free-until as free cancellation, and nothing else", () => {
    expect(isFreeCancellation({ kind: "free" })).toBe(true);
    expect(isFreeCancellation({ kind: "free-until", deadline: 0, later: [] })).toBe(true);
    expect(isFreeCancellation({ kind: "penalty-now", amount: TOTAL, later: [] })).toBe(false);
    expect(isFreeCancellation({ kind: "non-refundable", amount: TOTAL })).toBe(false);
    expect(isFreeCancellation({ kind: "unknown" })).toBe(false);
  });

  it("agrees with the sentence on every recorded rate: free exactly when the sentence starts 'Free to cancel'", () => {
    for (const fixture of [hp10004834, hp8819557]) {
      for (const raw of (fixture as { hotels: { rates: unknown[] }[] }).hotels[0]!.rates) {
        for (const pt of RateSchema.parse(raw).payment_options.payment_types) {
          const total = { amount: pt.show_amount, currency: pt.show_currency_code };
          for (const now of [NOW, new Date("2026-12-09T12:00:00Z"), new Date("2026-12-12T00:00:00Z")]) {
            const sentence = cancellationSentence({ penalties: pt.cancellation_penalties, total, markupPercent: 0, timeZone: "UTC", now });
            expect(isFreeCancellation(cancellationStatus(pt.cancellation_penalties, total, 0, now))).toBe(sentence.startsWith("Free to cancel"));
          }
        }
      }
    }
  });
});
