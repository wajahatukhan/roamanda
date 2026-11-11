import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReviewSummary } from "@/components/review-summary";

const html = (hotel: Parameters<typeof ReviewSummary>[0]["hotel"]) => renderToStaticMarkup(createElement(ReviewSummary, { hotel }));

describe("ReviewSummary", () => {
  const rated = { reviewRating: 8.6, reviewDetailed: { cleanness: 9.1, location: 8.4, wifi: null, price: 7.9 } };

  test("shows the overall score and each category score", () => {
    const out = html(rated);
    expect(out).toContain(">8.6<");
    for (const [label, score] of [["Cleanliness", "9.1"], ["Location", "8.4"], ["Value for money", "7.9"]]) {
      expect(out).toContain(`<dt>${label}</dt>`);
      expect(out).toContain(`>${score}</dd>`);
    }
    expect(out).not.toContain("Wi-Fi"); // no value, not listed
  });

  test("every dt and dd sits directly in one wrapping div that is a direct child of the dl", () => {
    // Tiny tag walker: the markup has no void elements, so a stack of open tags is the parent chain.
    const stack: string[] = [];
    const parents: { tag: string; parent: string; grandparent: string }[] = [];
    for (const m of html(rated).matchAll(/<(\/?)([a-z0-9]+)[^>]*>/g)) {
      const [, closing, tag] = m;
      if (closing) stack.pop();
      else {
        if (tag === "dt" || tag === "dd") parents.push({ tag, parent: stack.at(-1)!, grandparent: stack.at(-2)! });
        stack.push(tag!);
      }
    }
    expect(parents.map((p) => p.tag)).toEqual(["dt", "dd", "dt", "dd", "dt", "dd"]);
    for (const p of parents) expect([p.parent, p.grandparent]).toEqual(["div", "dl"]);
  });

  test("renders nothing without an overall rating", () => {
    expect(html({ reviewRating: null, reviewDetailed: { cleanness: 9 } })).toBe("");
  });
});
