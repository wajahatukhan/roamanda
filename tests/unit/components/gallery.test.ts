import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Gallery } from "@/components/gallery";

// A host the optimiser does not serve, so the lead photo renders as plain markup.
const images = (n: number) => Array.from({ length: n }, (_, i) => ({ category: "unspecified", url: `https://cdn.example.test/t/{size}/p${i + 1}.jpg` }));
const html = (n: number) => renderToStaticMarkup(createElement(Gallery, { images: images(n) }));

describe("Gallery", () => {
  test("on a phone: the lead photo, and a caption with the total number of photos, shown below 640 px only", () => {
    const out = html(50);
    expect(out).toContain('<p class="text-sm text-muted-foreground sm:hidden">50 photos</p>');
    // The longer line is for the thumbnail grid, from 640 px up.
    expect(out).toContain('<p class="hidden text-sm text-muted-foreground sm:block">Showing 12 of 50 photos.</p>');
  });

  test("thumbnails are hidden below 640 px and their photo is only in a source that matches from 640 px up", () => {
    const out = html(3);
    const thumbs = [...out.matchAll(/<div class="relative hidden aspect-\[4\/3\][^"]*sm:block"><picture>(.*?)<\/picture><\/div>/g)].map((m) => m[1]!);
    expect(thumbs).toHaveLength(2);
    thumbs.forEach((t, i) => {
      expect(t).toContain(`<source media="(min-width: 640px)" srcSet="https://cdn.example.test/t/x220/p${i + 2}.jpg"/>`);
      // The <img> itself never names the photo's URL, so a phone requests nothing for it.
      const src = /<img src="([^"]+)"/.exec(t)![1]!;
      expect(src.startsWith("data:image/gif;base64,")).toBe(true);
      expect(t).toContain(`alt="Photo ${i + 2} of 3"`);
      expect(t).toContain('loading="lazy"');
    });
  });

  test("the lead photo is not hidden at any width", () => {
    const out = html(3);
    const lead = /<div class="([^"]*)"><picture><source media="\(min-width: 640px\)" srcSet="https:\/\/cdn\.example\.test\/t\/1024x768\/p1\.jpg"/.exec(out);
    expect(lead).not.toBeNull();
    expect(lead![1]!.split(" ")).not.toContain("hidden");
  });

  test("no caption for a single photo, and the designed state for none", () => {
    expect(html(1)).not.toContain("photos</p>");
    expect(html(0)).toContain("Photos are not available for this hotel yet.");
  });
});
