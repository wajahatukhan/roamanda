import { describe, expect, it } from "vitest";
import { describeStay, nightsBetween } from "@/lib/search/summary";
import { initialFormValues } from "@/lib/search/initial";

describe("nightsBetween", () => {
  it("counts nights across a month end", () => expect(nightsBetween("2026-12-30", "2027-01-02")).toBe(3));
});

describe("describeStay", () => {
  it("summarises dates, nights and guests", () => {
    expect(describeStay({ checkin: "2026-12-11", checkout: "2026-12-13", guests: [{ adults: 2, children: [] }] })).toBe(
      "11 Dec – 13 Dec 2026 · 2 nights · 2 adults · 1 room",
    );
  });
  it("uses singular forms and counts children", () => {
    expect(describeStay({ checkin: "2026-12-11", checkout: "2026-12-12", guests: [{ adults: 1, children: [4] }, { adults: 1, children: [] }] })).toBe(
      "11 Dec – 12 Dec 2026 · 1 night · 2 adults, 1 child · 2 rooms",
    );
  });
});

describe("initialFormValues", () => {
  it("keeps what is valid and drops what is not", () => {
    const v = initialFormValues({ region: "2011", name: "Paris", in: "2026-12-11", out: "nope", rooms: "2-4.9" });
    expect(v.destination).toEqual({ kind: "region", id: 2011, name: "Paris" });
    expect(v.range).toBeUndefined();
    expect(v.rooms).toEqual([{ adults: 2, children: [4, 9] }]);
  });
  it("passes the stay dates on as YYYY-MM-DD strings, never as Date objects", () => {
    const v = initialFormValues({ in: "2026-12-11", out: "2026-12-13" });
    expect(v.range).toEqual({ from: "2026-12-11", to: "2026-12-13" });
    expect(v.destination).toBeNull();
  });
  it("drops dates that are not real, or a check-out that is not after check-in", () => {
    expect(initialFormValues({ in: "2026-02-30", out: "2026-03-02" }).range).toBeUndefined();
    expect(initialFormValues({ in: "2026-12-13", out: "2026-12-13" }).range).toBeUndefined();
    expect(initialFormValues({ in: "2026-12-13", out: "2026-12-11" }).range).toBeUndefined();
    expect(initialFormValues({ in: "2026-12-1", out: "2026-12-13" }).range).toBeUndefined();
  });
  it("needs a name to show a destination", () => {
    expect(initialFormValues({ region: "2011" }).destination).toBeNull();
  });
});
