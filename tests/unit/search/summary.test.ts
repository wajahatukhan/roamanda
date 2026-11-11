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
  it("builds a local-date range", () => {
    const v = initialFormValues({ in: "2026-12-11", out: "2026-12-13" });
    expect(v.range?.from?.getFullYear()).toBe(2026);
    expect(v.range?.from?.getDate()).toBe(11);
    expect(v.range?.to?.getDate()).toBe(13);
    expect(v.destination).toBeNull();
  });
  it("needs a name to show a destination", () => {
    expect(initialFormValues({ region: "2011" }).destination).toBeNull();
  });
});
