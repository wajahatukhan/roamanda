/**
 * Records hotel content fixtures into tests/fixtures/etg/ from the ETG sandbox.
 * Run: npx tsx --conditions=react-server scripts/record-content-fixtures.ts   (needs live credentials in .env.local)
 *
 * Writes content-10004834.json (one raw hotel), content-hotels.json (every hid in serp-region.json plus
 * the two feature hotels: raw content and review summaries) and static.json (English tax and meal names).
 * Calls each endpoint a fixed small number of times: 1 content call (max 100 hids), 1 reviews call, 1 static call.
 */
import { readFileSync, writeFileSync } from "node:fs";

process.loadEnvFile(".env.local");

const OUT = "tests/fixtures/etg";
const MAX_BYTES = 400_000;
const FEATURE_HIDS = [10004834, 8819557];

const { fetchHotelContent, fetchHotelReviewSummaries, fetchStaticDictionaries } = await import("../src/lib/etg/content");

const serp = JSON.parse(readFileSync(`${OUT}/serp-region.json`, "utf8")) as { hotels: { hid: number }[] };
const hids = [...new Set([...serp.hotels.map((h) => h.hid), ...FEATURE_HIDS])];
if (hids.length > 100) throw new Error("more than 100 hids: this script makes a single content call");

const content = (await fetchHotelContent(hids)) as ({ hid: number; description_struct?: { paragraphs?: string[] }[] } & Record<string, unknown>)[];
const reviews = await fetchHotelReviewSummaries(hids);
console.log(`hids ${hids.length}, content ${content.length}, reviews ${reviews.length}`);

const feature = content.find((h) => h.hid === 10004834);
if (!feature) throw new Error("content for 10004834 was not returned");
writeFileSync(`${OUT}/content-10004834.json`, JSON.stringify(feature, null, 2) + "\n");

// Deterministic size trim: shorten every description paragraph to at most N characters, N from a fixed ladder.
const render = (rows: typeof content) => JSON.stringify({ hotels: rows, reviews }, null, 2) + "\n";
const shorten = (rows: typeof content, max: number) =>
  rows.map((h) => ({
    ...h,
    description_struct: h.description_struct?.map((s) => ({ ...s, paragraphs: s.paragraphs?.map((p) => (p.length > max ? p.slice(0, max) : p)) })),
  }));
let rows = content;
let trimmedTo: number | null = null;
for (const max of [1000, 600, 400, 250, 150, 80]) {
  if (Buffer.byteLength(render(rows)) <= MAX_BYTES) break;
  rows = shorten(content, max);
  trimmedTo = max;
}
const text = render(rows);
writeFileSync(`${OUT}/content-hotels.json`, text);
console.log(`wrote content-hotels.json (${Buffer.byteLength(text)} bytes)${trimmedTo ? `; description paragraphs trimmed to ${trimmedTo} chars` : "; not trimmed"}`);

const dict = await fetchStaticDictionaries();
writeFileSync(`${OUT}/static.json`, JSON.stringify(dict, null, 2) + "\n");
console.log(`wrote static.json (taxes ${Object.keys(dict.taxNames).length}, meals ${Object.keys(dict.mealNames).length})`);
