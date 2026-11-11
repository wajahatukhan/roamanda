import { describe, expect, it } from "vitest";
import { priceCaption } from "@/components/price";

describe("priceCaption", () => {
  it("says taxes and fees are included when nothing is payable at the hotel", () => {
    expect(priceCaption(2, false)).toBe("for 2 nights, taxes and fees included");
    expect(priceCaption(1, false)).toBe("for 1 night, taxes and fees included");
  });
  it("says which taxes and fees are included when something is payable at the hotel", () => {
    expect(priceCaption(3, true)).toBe("for 3 nights, taxes and fees charged at booking included");
    expect(priceCaption(1, true)).toBe("for 1 night, taxes and fees charged at booking included");
  });
});
