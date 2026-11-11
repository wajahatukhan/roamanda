import { imageUrl } from "@/lib/content/image-url";
import type { HotelImage } from "@/lib/content/types";
import { humanize } from "./format";

export type Photo = { n: number; large: string; small: string; alt: string };

/** How many photos the page shows; the rest are counted, not rendered. */
export const MAX_PHOTOS = 12;

function secure(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/** Photos whose URL is https once sized, with alt text that says which photo it is, not the hotel name again. */
export function galleryPhotos(images: HotelImage[]): { photos: Photo[]; total: number } {
  const usable = images.filter((i) => secure(imageUrl(i.url, "1024x768")));
  const total = usable.length;
  const photos = usable.slice(0, MAX_PHOTOS).map((image, index) => {
    const category = image.category && image.category !== "unspecified" ? humanize(image.category) : null;
    return {
      n: index + 1,
      large: imageUrl(image.url, "1024x768"),
      small: imageUrl(image.url, "640x350"),
      alt: `Photo ${index + 1} of ${total}${category ? `: ${category}` : ""}`,
    };
  });
  return { photos, total };
}
