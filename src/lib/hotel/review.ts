import type { Hotel } from "@/lib/content/types";
import { humanize } from "./format";

const LABELS: Record<string, string> = {
  cleanness: "Cleanliness",
  location: "Location",
  price: "Value for money",
  services: "Service",
  room: "Rooms",
  meal: "Meals",
  wifi: "Wi-Fi",
  hygiene: "Hygiene",
};

export type ReviewModel = { score: string; categories: { key: string; label: string; score: string; fraction: number }[] };

const isScore = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 10;

/**
 * What the review block shows. Null (no block at all) when the hotel has no overall rating: never a "0"
 * and never an empty box. Category scores are listed only for those that have a value.
 */
export function reviewModel(hotel: Pick<Hotel, "reviewRating" | "reviewDetailed">): ReviewModel | null {
  if (!isScore(hotel.reviewRating)) return null;
  const categories = Object.entries(hotel.reviewDetailed ?? {})
    .filter((entry): entry is [string, number] => isScore(entry[1]))
    .map(([key, value]) => ({
      key,
      label: Object.hasOwn(LABELS, key) ? LABELS[key]! : humanize(key),
      score: value.toFixed(1),
      fraction: value / 10,
    }));
  return { score: hotel.reviewRating.toFixed(1), categories };
}
