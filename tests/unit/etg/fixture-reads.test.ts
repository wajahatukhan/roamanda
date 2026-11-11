import { describe, expect, it } from "vitest";
import { countHotelPageFixtureRead, hotelPageFixtureReads, parseFixtureTag } from "@/lib/etg/fixture-reads";

describe("fixture read counter", () => {
  it("counts in fixture mode, per tag", () => {
    countHotelPageFixtureRead("fixture", "t-a");
    countHotelPageFixtureRead("fixture", "t-a");
    countHotelPageFixtureRead("fixture", "t-b");
    expect(hotelPageFixtureReads("fixture", "t-a")).toBe(2);
    expect(hotelPageFixtureReads("fixture", "t-b")).toBe(1);
    expect(hotelPageFixtureReads("fixture", "t-none")).toBe(0);
  });
  it("is inert in live mode: nothing is counted and nothing is reported", () => {
    countHotelPageFixtureRead("live", "t-live");
    countHotelPageFixtureRead("live");
    expect(hotelPageFixtureReads("fixture", "t-live")).toBe(0);
    expect(hotelPageFixtureReads("live", "t-live")).toBe(0);
    expect(hotelPageFixtureReads("live")).toBe(0);
  });
  it("takes a tag only in fixture mode and only when it is plain", () => {
    expect(parseFixtureTag("fixture", "abc-123")).toBe("abc-123");
    expect(parseFixtureTag("live", "abc-123")).toBe("");
    expect(parseFixtureTag("fixture", "A B")).toBe("");
    expect(parseFixtureTag("fixture", "x".repeat(41))).toBe("");
    expect(parseFixtureTag("fixture", undefined)).toBe("");
    expect(parseFixtureTag("fixture", null)).toBe("");
  });
});
