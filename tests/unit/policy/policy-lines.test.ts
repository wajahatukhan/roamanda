import { describe, expect, it } from "vitest";
import type { CancellationPenalties } from "@/lib/etg/types";
import { POLICY_LINES_FALLBACK, policyLines } from "@/lib/policy/policy-lines";

const NOW = new Date("2026-06-01T00:00:00Z");
const p = (start_at: string | null, end_at: string | null, amount: string) => ({ start_at, end_at, amount_charge: amount, amount_show: amount });

function lines(penalties: CancellationPenalties, o: { timeZone?: string; markupPercent?: number; now?: Date } = {}) {
  return policyLines({ penalties, total: { amount: "200.00", currency: "USD" }, markupPercent: o.markupPercent ?? 10, timeZone: o.timeZone ?? "Asia/Dubai", now: o.now ?? NOW });
}

describe("policyLines", () => {
  it("free then penalty, with the hotel's stated deadline last", () => {
    expect(
      lines({ free_cancellation_before: "2026-06-27T19:59:00", policies: [p(null, "2026-06-27T19:59:00", "0.00"), p("2026-06-27T19:59:00", null, "100.00")] }),
    ).toEqual([
      "Until 27 June, 11:59 pm Dubai time: free",
      "From 27 June, 11:59 pm Dubai time: you lose $110.00",
      "Free cancellation deadline stated by the hotel: 27 June, 11:59 pm Dubai time",
    ]);
  });

  it("multi-tier, in time order whatever order they arrive in, capped at the total", () => {
    const penalties = {
      free_cancellation_before: null,
      policies: [p("2026-06-20T20:00:00", null, "500.00"), p(null, "2026-06-10T20:00:00", "0.00"), p("2026-06-10T20:00:00", "2026-06-20T20:00:00", "50.00")],
    };
    expect(lines(penalties)).toEqual([
      "Until 11 June, 12:00 am Dubai time: free",
      "From 11 June, 12:00 am Dubai time: you lose $55.00",
      "From 21 June, 12:00 am Dubai time: you lose $200.00",
    ]);
  });

  it("open-ended free, and a penalty with neither start nor end", () => {
    expect(lines({ free_cancellation_before: null, policies: [p(null, null, "0.00")] })).toEqual(["At any time: free"]);
    expect(lines({ free_cancellation_before: null, policies: [p(null, null, "50.00")] })).toEqual(["At any time: you lose $55.00"]);
  });

  it("a penalty that has an end but no start", () => {
    expect(lines({ free_cancellation_before: null, policies: [p(null, "2026-06-10T20:00:00", "50.00"), p("2026-06-10T20:00:00", null, "100.00")] })).toEqual([
      "Until 11 June, 12:00 am Dubai time: you lose $55.00",
      "From 11 June, 12:00 am Dubai time: you lose $110.00",
    ]);
  });

  it("lists what the supplier sent even where the sentence has to fall back (overlap, gap)", () => {
    expect(lines({ free_cancellation_before: null, policies: [p(null, "2026-06-27T00:00:00", "0.00"), p("2026-05-01T00:00:00", null, "100.00")] })).toEqual([
      "Until 27 June, 4:00 am Dubai time: free",
      "From 1 May, 4:00 am Dubai time: you lose $110.00",
    ]);
    expect(lines({ free_cancellation_before: null, policies: [p(null, "2026-06-10T20:00:00", "0.00"), p("2026-06-15T20:00:00", null, "100.00")] })).toEqual([
      "Until 11 June, 12:00 am Dubai time: free",
      "From 16 June, 12:00 am Dubai time: you lose $110.00",
    ]);
  });

  it("shows the year when it is not the current one", () => {
    expect(lines({ free_cancellation_before: null, policies: [p(null, "2027-01-05T10:00:00", "0.00"), p("2027-01-05T10:00:00", null, "100.00")] })[0]).toBe(
      "Until 5 January 2027, 2:00 pm Dubai time: free",
    );
  });

  it("converts each instant with the zone's own offset on that date (daylight saving)", () => {
    // London is UTC+1 until 25 October 2026 and UTC+0 after.
    expect(
      lines(
        { free_cancellation_before: "2026-10-24T22:00:00", policies: [p(null, "2026-10-24T22:00:00", "0.00"), p("2026-10-24T22:00:00", "2026-10-26T22:00:00", "50.00"), p("2026-10-26T22:00:00", null, "100.00")] },
        { timeZone: "Europe/London" },
      ),
    ).toEqual([
      "Until 24 October, 11:00 pm London time: free",
      "From 24 October, 11:00 pm London time: you lose $55.00",
      "From 26 October, 10:00 pm London time: you lose $110.00",
      "Free cancellation deadline stated by the hotel: 24 October, 11:00 pm London time",
    ]);
  });

  it("is empty (so the page shows the fallback) for an empty list or anything unparseable, and never throws", () => {
    expect(lines({ free_cancellation_before: null, policies: [] })).toEqual([]);
    expect(lines({ free_cancellation_before: "2026-06-10T00:00:00", policies: [] })).toEqual([]);
    expect(lines({ free_cancellation_before: "not-a-date", policies: [p(null, null, "0.00")] })).toEqual([]);
    expect(lines({ free_cancellation_before: null, policies: [p(null, "2026-02-30T10:00:00", "0.00"), p("2026-02-30T10:00:00", null, "100.00")] })).toEqual([]);
    expect(lines({ free_cancellation_before: null, policies: [p(null, null, "-5")] })).toEqual([]);
    expect(lines({ free_cancellation_before: null, policies: [p(null, null, "abc")] })).toEqual([]);
    expect(POLICY_LINES_FALLBACK).toBe("The hotel did not provide cancellation terms we can display. Ask us before you book.");
  });
});
