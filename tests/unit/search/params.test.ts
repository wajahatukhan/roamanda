import { describe, expect, it } from "vitest";
import { decodeRooms, encodeRooms, parseSearchParams } from "@/lib/search/params";

const today = new Date("2026-11-11T09:00:00Z");
const valid = { region: "2011", name: "Berlin", in: "2026-12-10", out: "2026-12-12", rooms: "2-5.9,1" };

function problemsFor(overrides: Record<string, string | string[] | undefined>): string[] {
  const r = parseSearchParams({ ...valid, ...overrides }, today);
  return r.ok ? [] : r.problems;
}

describe("parseSearchParams", () => {
  it("parses a valid URL", () => {
    expect(parseSearchParams(valid, today)).toEqual({
      ok: true,
      regionId: 2011,
      regionName: "Berlin",
      query: {
        checkin: "2026-12-10",
        checkout: "2026-12-12",
        currency: "USD",
        guests: [
          { adults: 2, children: [5, 9] },
          { adults: 1, children: [] },
        ],
      },
    });
  });

  it("accepts today as check-in and a 30-night stay", () => {
    expect(parseSearchParams({ ...valid, in: "2026-11-11", out: "2026-12-11" }, today).ok).toBe(true);
  });

  it("rejects a check-in in the past", () => {
    expect(problemsFor({ in: "2026-11-10", out: "2026-11-12" })).toContain("Check-in is in the past.");
  });

  it("rejects a check-out that is not after check-in", () => {
    expect(problemsFor({ out: "2026-12-10" })).toContain("Check-out must be after check-in.");
    expect(problemsFor({ out: "2026-12-09" })).toContain("Check-out must be after check-in.");
  });

  it("rejects stays over 30 nights", () => {
    expect(problemsFor({ in: "2026-12-01", out: "2027-01-01" })).toContain("Stays can be up to 30 nights.");
  });

  it("rejects more than 6 adults in a room", () => {
    expect(problemsFor({ rooms: "7" })).toContain("Up to 6 adults per room.");
  });

  it("rejects child ages over 17", () => {
    expect(problemsFor({ rooms: "2-18" })).toContain("Children are aged 17 or under.");
  });

  it("rejects more than 4 children in a room", () => {
    expect(problemsFor({ rooms: "2-1.2.3.4.5" })).toContain("Up to 4 children per room.");
  });

  it("rejects more than 9 rooms", () => {
    expect(problemsFor({ rooms: Array(10).fill("1").join(",") })).toContain("Up to 9 rooms.");
  });

  it("requires a destination", () => {
    expect(problemsFor({ region: undefined })).toContain("Choose a destination.");
    expect(problemsFor({ region: "abc" })).toContain("Choose a destination.");
  });

  it("requires valid dates", () => {
    expect(problemsFor({ in: undefined })).toContain("Choose your check-in and check-out dates.");
    expect(problemsFor({ out: "2026-02-31" })).toContain("Choose your check-in and check-out dates.");
  });

  it("rejects malformed rooms and at least one adult is required", () => {
    expect(problemsFor({ rooms: "x" })).toContain("Check the guest details.");
    expect(problemsFor({ rooms: "0" })).toContain("Each room needs at least 1 adult.");
  });

  it("defaults to two adults in one room when rooms is missing", () => {
    const r = parseSearchParams({ ...valid, rooms: undefined }, today);
    expect(r.ok && r.query.guests).toEqual([{ adults: 2, children: [] }]);
  });

  it("uses the first value of a repeated parameter", () => {
    const r = parseSearchParams({ ...valid, region: ["2011", "5"] }, today);
    expect(r.ok && r.regionId).toBe(2011);
  });
});

describe("encodeRooms / decodeRooms", () => {
  it("round-trips", () => {
    const g = [
      { adults: 2, children: [5, 9] },
      { adults: 1, children: [] },
    ];
    expect(encodeRooms(g)).toBe("2-5.9,1");
    expect(decodeRooms(encodeRooms(g))).toEqual(g);
  });

  it("returns null for malformed input", () => {
    for (const s of ["", "a", "2-", "2-x", "2--1", ",", "2,,1", "1.5"]) expect(decodeRooms(s)).toBeNull();
  });
});
