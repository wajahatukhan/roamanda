import { describe, expect, test } from "vitest";
import { hotelTimeZone, zoneLabel } from "@/lib/policy/time-zone";

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
});
