import { canOptimise, imageUrl, isHttpsUrl } from "@/lib/content/image-url";
import type { HotelImage } from "@/lib/content/types";
import { humanize } from "./format";

/** `optimised`: the supplier URL is on the host the image optimiser may fetch from; otherwise the page uses a plain `<img>`. */
export type Photo = { n: number; large: string; medium: string; small: string; alt: string; optimised: boolean };

/** How many photos the page shows; the rest are counted, not rendered. */
export const MAX_PHOTOS = 12;

/** The search card's photo: the first image at 640x350, only when that URL is https; otherwise null (the no-photo state). */
export function cardPhotoUrl(images: HotelImage[]): string | null {
  const first = images[0];
  if (!first) return null;
  const url = imageUrl(first.url, "640x350");
  return isHttpsUrl(url) ? url : null;
}

/** Photos whose URL is https once sized, with alt text that says which photo it is, not the hotel name again. */
export function galleryPhotos(images: HotelImage[]): { photos: Photo[]; total: number } {
  const usable = images.filter((i) => isHttpsUrl(imageUrl(i.url, "1024x768")));
  const total = usable.length;
  const photos = usable.slice(0, MAX_PHOTOS).map((image, index) => {
    const category = image.category && image.category !== "unspecified" ? humanize(image.category) : null;
    return {
      n: index + 1,
      large: imageUrl(image.url, "1024x768"),
      medium: imageUrl(image.url, "640x350"),
      small: imageUrl(image.url, "x220"),
      optimised: canOptimise(imageUrl(image.url, "1024x768")) && canOptimise(imageUrl(image.url, "640x350")),
      alt: `Photo ${index + 1} of ${total}${category ? `: ${category}` : ""}`,
    };
  });
  return { photos, total };
}
