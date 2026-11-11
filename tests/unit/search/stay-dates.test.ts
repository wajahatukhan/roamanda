import { afterEach, describe, expect, it } from "vitest";
import { isoRangeToLocal, isoToLocalDate, localDateToIso } from "@/lib/search/stay-dates";

// Node applies a new process.env.TZ at once, so each zone is tested in this one process.
const ORIGINAL_TZ = process.env.TZ;
afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

// West and east of UTC, UTC itself, and Santiago, whose daylight-saving change happens at midnight.
const ZONES = ["America/Los_Angeles", "America/New_York", "Pacific/Auckland", "UTC", "America/Santiago"];

describe.each(ZONES)("in %s", (zone) => {
  it("builds the same calendar day from a YYYY-MM-DD string, from its parts", () => {
    process.env.TZ = zone;
    const d = isoToLocalDate("2026-12-11")!;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 11, 11]);
  });

  it("round-trips string -> local date -> string", () => {
    process.env.TZ = zone;
    for (const s of ["2026-12-11", "2026-12-13", "2026-01-01", "2026-12-31", "2028-02-29", "2026-09-06", "2026-04-05"]) {
      expect(localDateToIso(isoToLocalDate(s)!)).toBe(s);
    }
  });

  it("emits a local date's own day, not its UTC day", () => {
    process.env.TZ = zone;
    // Late evening and early morning local time are the cases that cross the UTC date line.
    expect(localDateToIso(new Date(2026, 11, 11, 23, 30))).toBe("2026-12-11");
    expect(localDateToIso(new Date(2026, 11, 11, 0, 30))).toBe("2026-12-11");
  });
});

describe("isoToLocalDate", () => {
  it("rejects anything that is not a real YYYY-MM-DD date", () => {
    for (const bad of ["2026-02-30", "2026-13-01", "2026-00-10", "2026-12-1", "26-12-11", "2026-12-11T00:00:00Z", "", "nope", undefined, null]) {
      expect(isoToLocalDate(bad)).toBeNull();
    }
  });
  it("keeps a four-digit year below 100 as given", () => {
    expect(localDateToIso(isoToLocalDate("0099-01-01")!)).toBe("0099-01-01");
  });
});

describe("isoRangeToLocal", () => {
  it("converts both ends, or gives undefined when either is unusable", () => {
    process.env.TZ = "America/Los_Angeles";
    const r = isoRangeToLocal({ from: "2026-12-11", to: "2026-12-13" })!;
    expect([r.from.getDate(), r.to.getDate()]).toEqual([11, 13]);
    expect(isoRangeToLocal({ from: "2026-12-11", to: "bad" })).toBeUndefined();
    expect(isoRangeToLocal(undefined)).toBeUndefined();
  });
});
