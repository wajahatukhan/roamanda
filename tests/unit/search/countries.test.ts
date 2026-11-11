import { describe, expect, it } from "vitest";
import { COUNTRIES, normalizeResidency } from "@/lib/search/countries";

describe("countries", () => {
  it("lists well-known countries with English names, sorted", () => {
    expect(COUNTRIES.find((c) => c.code === "gb")?.name).toBe("United Kingdom");
    expect(COUNTRIES.find((c) => c.code === "us")?.name).toBe("United States");
    expect(COUNTRIES.length).toBeGreaterThan(200);
    expect(COUNTRIES.some((c) => ["eu", "zz", "un"].includes(c.code))).toBe(false);
  });

  it("normalizes valid codes to lower case and rejects invalid ones", () => {
    expect(normalizeResidency("GB")).toBe("gb");
    expect(normalizeResidency("gb")).toBe("gb");
    expect(normalizeResidency("zz")).toBeNull();
    expect(normalizeResidency("gbr")).toBeNull();
    expect(normalizeResidency("")).toBeNull();
    expect(normalizeResidency(undefined)).toBeNull();
  });
});
