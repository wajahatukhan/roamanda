import { cacheLife } from "next/cache";
import { getHotel } from "@/lib/content/store";
import type { Hotel } from "@/lib/content/types";

/**
 * Stored hotel content (no RateHawk call, no prices), safe to cache: it changes only when the content sync runs.
 * Rates are never read through this. They are fetched in rates.tsx at request time.
 */
export async function getHotelContent(hid: number): Promise<Hotel | null> {
  "use cache";
  cacheLife("minutes");
  return getHotel(hid);
}
