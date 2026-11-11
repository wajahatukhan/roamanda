import { describe, expect, it } from "vitest";
import { EtgError } from "@/lib/etg/errors";
import { fixtureDelayMs, fixtureEmpty, fixtureFailure } from "@/lib/search/fixture-failure";

describe("fixtureFailure", () => {
  it("serp makes a retryable EtgError in fixture mode", () => {
    const e = fixtureFailure("fixture", "serp");
    expect(e).toBeInstanceOf(EtgError);
    expect(e?.retryable).toBe(true);
  });
  it("serp-fatal makes a non-retryable EtgError in fixture mode", () => {
    expect(fixtureFailure("fixture", "serp-fatal")?.retryable).toBe(false);
  });
  it("is ignored in live mode", () => {
    expect(fixtureFailure("live", "serp")).toBeNull();
    expect(fixtureFailure("live", "serp-fatal")).toBeNull();
  });
  it("ignores absent or unknown values", () => {
    expect(fixtureFailure("fixture", undefined)).toBeNull();
    expect(fixtureFailure("fixture", "other")).toBeNull();
  });
});

describe("fixtureDelayMs", () => {
  it("reads a delay in fixture mode, capped at 5 seconds", () => {
    expect(fixtureDelayMs("fixture", "1500")).toBe(1500);
    expect(fixtureDelayMs("fixture", "999999")).toBe(5000);
  });
  it("is zero in live mode or for junk", () => {
    expect(fixtureDelayMs("live", "1500")).toBe(0);
    expect(fixtureDelayMs("fixture", "abc")).toBe(0);
    expect(fixtureDelayMs("fixture", undefined)).toBe(0);
  });
});

describe("fixtureEmpty", () => {
  it("serp-empty empties the search in fixture mode only", () => {
    expect(fixtureEmpty("fixture", "serp-empty")).toBe(true);
    expect(fixtureEmpty("live", "serp-empty")).toBe(false);
    expect(fixtureEmpty("fixture", "serp")).toBe(false);
    expect(fixtureEmpty("fixture", undefined)).toBe(false);
  });
  it("serp-empty is not a failure", () => {
    expect(fixtureFailure("fixture", "serp-empty")).toBeNull();
  });
});
