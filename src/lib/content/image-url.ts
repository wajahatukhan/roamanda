export type ImageSize = "640x350" | "1024x768" | "x220";

/** ETG image URLs carry a literal `{size}` placeholder. */
export function imageUrl(url: string, size: ImageSize): string {
  return url.replace("{size}", size);
}
