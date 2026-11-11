import { afterEach, describe, expect, it, vi } from "vitest";
import { recordMissingSafely } from "@/lib/search/record-missing";

afterEach(() => vi.restoreAllMocks());

describe("recordMissingSafely", () => {
  it("passes the hids on", async () => {
    const record = vi.fn().mockResolvedValue(undefined);
    await recordMissingSafely([1, 2], record);
    expect(record).toHaveBeenCalledWith([1, 2]);
  });
  it("does nothing when there is nothing missing", async () => {
    const record = vi.fn();
    await recordMissingSafely([], record);
    expect(record).not.toHaveBeenCalled();
  });
  it("logs and swallows a failure", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(recordMissingSafely([1], () => Promise.reject(new Error("db down")))).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledOnce();
    expect(String(log.mock.calls[0]?.join(" "))).toContain("db down");
  });
  it("swallows a synchronous throw too", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      recordMissingSafely([1], () => {
        throw new Error("boom");
      }),
    ).resolves.toBeUndefined();
  });
});
