export type ImageSize = "640x350" | "1024x768" | "x220";

/** ETG image URLs carry a literal `{size}` placeholder. */
export function imageUrl(url: string, size: ImageSize): string {
  return url.replace("{size}", size);
}

/** True when the URL parses and is https. Pages never load a photo over anything else. */
export function isHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * The one supplier image host and path prefix that Next's image optimiser may fetch from.
 * `images.remotePatterns` in next.config.ts must say the same (a unit test checks that).
 */
export const OPTIMISED_IMAGE_HOST = "cdn.worldota.net";
export const OPTIMISED_IMAGE_PATH_PREFIX = "/t/";

/** True when the URL is https, on the allowed supplier host and under its image path, with no query string. */
export function canOptimise(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === OPTIMISED_IMAGE_HOST && u.port === "" && u.pathname.startsWith(OPTIMISED_IMAGE_PATH_PREFIX) && u.search === "";
  } catch {
    return false;
  }
}
