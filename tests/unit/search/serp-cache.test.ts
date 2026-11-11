import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StayQuery } from "@/lib/etg/schemas";
import { cachedSearchRegion, clearSerpCache } from "@/lib/search/serp-cache";

const Q: StayQuery = { checkin: "2026-12-01", checkout: "2026-12-03", residency: "us", guests: [{ adults: 2, children: [] }], currency: "USD" };
const OUT = [{ hid: 1, rates: [] }];
const TTL = 5 * 60 * 1000;

beforeEach(() => clearSerpCache());

describe("cachedSearchRegion", () => {
  it("serves a second identical call within the TTL without searching", async () => {
    const search = vi.fn().mockResolvedValue(OUT);
    let t = 1000;
    const deps = { search, now: () => t };
    expect(await cachedSearchRegion(1, Q, deps)).toBe(OUT);
    t += TTL - 1;
    expect(await cachedSearchRegion(1, Q, deps)).toBe(OUT);
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("searches again after the TTL", async () => {
    const search = vi.fn().mockResolvedValue(OUT);
    let t = 1000;
    const deps = { search, now: () => t };
    await cachedSearchRegion(1, Q, deps);
    t += TTL;
    await cachedSearchRegion(1, Q, deps);
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("misses for a different residency, dates, region, rooms or currency", async () => {
    const search = vi.fn().mockResolvedValue(OUT);
    const deps = { search, now: () => 1000 };
    await cachedSearchRegion(1, Q, deps);
    await cachedSearchRegion(1, { ...Q, residency: "gb" }, deps);
    await cachedSearchRegion(1, { ...Q, checkin: "2026-12-02" }, deps);
    await cachedSearchRegion(1, { ...Q, checkout: "2026-12-04" }, deps);
    await cachedSearchRegion(2, Q, deps);
    await cachedSearchRegion(1, { ...Q, guests: [{ adults: 2, children: [5] }] }, deps);
    await cachedSearchRegion(1, { ...Q, currency: "EUR" }, deps);
    expect(search).toHaveBeenCalledTimes(7);
  });

  it("shares one search between concurrent identical calls", async () => {
    const search = vi.fn().mockResolvedValue(OUT);
    const deps = { search, now: () => 1000 };
    await Promise.all([cachedSearchRegion(1, Q, deps), cachedSearchRegion(1, Q, deps), cachedSearchRegion(1, Q, deps)]);
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("does not cache a rejection, and the next call retries", async () => {
    const search = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValue(OUT);
    const deps = { search, now: () => 1000 };
    await expect(cachedSearchRegion(1, Q, deps)).rejects.toThrow("boom");
    expect(await cachedSearchRegion(1, Q, deps)).toBe(OUT);
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("keeps at most 200 entries, evicting the oldest", async () => {
    const search = vi.fn().mockResolvedValue(OUT);
    const deps = { search, now: () => 1000 };
    for (let r = 1; r <= 200; r++) await cachedSearchRegion(r, Q, deps);
    expect(search).toHaveBeenCalledTimes(200);
    await cachedSearchRegion(201, Q, deps); // evicts region 1
    expect(search).toHaveBeenCalledTimes(201);
    await cachedSearchRegion(2, Q, deps); // still cached
    expect(search).toHaveBeenCalledTimes(201);
    await cachedSearchRegion(1, Q, deps); // was evicted
    expect(search).toHaveBeenCalledTimes(202);
  });
});
