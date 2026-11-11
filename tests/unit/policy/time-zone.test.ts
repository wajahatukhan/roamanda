import { describe, expect, test } from "vitest";
import { cancellationSentence } from "@/lib/policy/cancellation-sentence";
import { hotelTimeZone, MINUS, zoneLabel } from "@/lib/policy/time-zone";

describe("time zones", () => {
  test("hotelTimeZone resolves an IANA zone from coordinates", () => {
    expect(hotelTimeZone(25.2048, 55.2708)).toBe("Asia/Dubai");
  });
  test("zoneLabel", () => {
    expect(zoneLabel("America/New_York")).toBe("New York time");
    expect(zoneLabel("Asia/Dubai")).toBe("Dubai time");
    expect(zoneLabel("America/Argentina/Buenos_Aires")).toBe("Buenos Aires time");
    expect(zoneLabel("UTC")).toBe("UTC");
  });
  test("zoneLabel names Etc/GMT zones by their real offset (the IANA sign is inverted)", () => {
    expect(MINUS).toBe("−");
    expect(zoneLabel("Etc/GMT+4")).toBe("UTC−4");
    expect(zoneLabel("Etc/GMT+12")).toBe("UTC−12");
    expect(zoneLabel("Etc/GMT-3")).toBe("UTC+3");
    expect(zoneLabel("Etc/GMT-14")).toBe("UTC+14");
    for (const zero of ["Etc/GMT", "Etc/UTC", "Etc/GMT+0", "Etc/GMT-0", "Etc/GMT0"]) expect(zoneLabel(zero)).toBe("UTC");
  });
  test("tz-lookup returns an Etc/GMT zone offshore, and its label has the right sign", () => {
    // Mid-Atlantic, far from any land: 30°W is in the UTC−2 nautical zone, which IANA writes as Etc/GMT+2.
    const zone = hotelTimeZone(0, -30);
    expect(zone).toBe("Etc/GMT+2");
    expect(zoneLabel(zone)).toBe("UTC−2");
  });
  test("a deadline in Etc/GMT+4 shows the time four hours behind UTC, labelled UTC−4", () => {
    const sentence = cancellationSentence({
      penalties: {
        free_cancellation_before: "2026-06-27T19:59:00",
        policies: [
          { start_at: null, end_at: "2026-06-27T19:59:00", amount_charge: "0.00", amount_show: "0.00" },
          { start_at: "2026-06-27T19:59:00", end_at: null, amount_charge: "181.82", amount_show: "181.82" },
        ],
      },
      total: { amount: "200.00", currency: "USD" },
      markupPercent: 10,
      timeZone: "Etc/GMT+4",
      now: new Date("2026-06-01T00:00:00Z"),
    });
    // 19:59 UTC is 15:59 at UTC−4.
    expect(sentence).toBe("Free to cancel until 27 June, 3:59 pm UTC−4. After that you lose $200.00.");
  });
});
