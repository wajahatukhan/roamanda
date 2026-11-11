import { describe, expect, test } from "vitest";
import { applyMarkup, formatMoney, minorUnits, roundMoney } from "@/lib/pricing/money";

describe("money", () => {
  test("12% markup on 211.25 USD is 236.60", () => {
    expect(applyMarkup({ amount: "211.25", currency: "USD" }, 12)).toEqual({ amount: "236.60", currency: "USD" });
  });
  test("rounds half up", () => {
    expect(roundMoney("10.005", "USD").amount).toBe("10.01");
  });
  test("JPY has no decimals", () => {
    expect(applyMarkup({ amount: "15000", currency: "JPY" }, 12.5)).toEqual({ amount: "16875", currency: "JPY" });
  });
  test("KWD has three decimals", () => {
    expect(roundMoney("10.0005", "KWD").amount).toBe("10.001");
  });
  test("minorUnits per currency", () => {
    expect(minorUnits("USD")).toBe(2);
    expect(minorUnits("JPY")).toBe(0);
    expect(minorUnits("KWD")).toBe(3);
  });
  test("markup outside 0-100 throws", () => {
    expect(() => applyMarkup({ amount: "1", currency: "USD" }, 101)).toThrow();
    expect(() => applyMarkup({ amount: "1", currency: "USD" }, -1)).toThrow();
  });
  test("markup of 0 returns the base unchanged", () => {
    expect(applyMarkup({ amount: "211.25", currency: "USD" }, 0)).toEqual({ amount: "211.25", currency: "USD" });
  });
  test("non-finite markup throws", () => {
    expect(() => applyMarkup({ amount: "1", currency: "USD" }, Number.NaN)).toThrow();
  });
  test("non-numeric or non-finite amounts throw instead of producing NaN", () => {
    expect(() => roundMoney("abc", "USD")).toThrow();
    expect(() => roundMoney("NaN", "USD")).toThrow();
    expect(() => roundMoney("Infinity", "USD")).toThrow();
    expect(() => roundMoney("", "USD")).toThrow();
    expect(() => applyMarkup({ amount: "abc", currency: "USD" }, 10)).toThrow();
  });
  test("formatMoney never uses floats", () => {
    expect(formatMoney({ amount: "1234567.10", currency: "USD" }, "en-US")).toBe("$1,234,567.10");
  });
  test("formatMoney keeps precision beyond float range", () => {
    expect(formatMoney({ amount: "12345678901234567.89", currency: "USD" }, "en-US")).toBe("$12,345,678,901,234,567.89");
  });
});
