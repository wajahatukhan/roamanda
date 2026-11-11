/**
 * Syncs hotel content from ETG into the Supabase `hotels` table.
 *
 *   npx tsx --conditions=react-server scripts/sync-content.ts --hids 10004834,8819557
 *   npx tsx --conditions=react-server scripts/sync-content.ts --from-fixture serp-region
 *   add --dry-run to fetch and map without writing anything (no database access, no static call)
 *   add --skip-dictionaries to leave the tax/meal dictionaries alone
 *
 * Needs live ETG credentials and, unless --dry-run, the Supabase URL and service key in .env.local.
 * Rate limits on this key: content 30 requests per 60 s (100 hids each), reviews 30 per 60 s,
 * static 100 per day (called at most once per run, and not at all with --dry-run).
 * The `--conditions=react-server` flag lets the `server-only` imports load outside Next.js.
 */
import { readFileSync } from "node:fs";
import { chunk } from "../src/lib/content/chunk";

process.loadEnvFile(".env.local");

const { fetchHotelContent, fetchHotelReviewSummaries, fetchStaticDictionaries, CONTENT_BATCH_SIZE } = await import("../src/lib/etg/content");
const { mapEtgHotels } = await import("../src/lib/content/map-hotel");

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const value = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const dryRun = flag("--dry-run");
const skipDictionaries = flag("--skip-dictionaries");

function resolveHids(): number[] {
  const list = value("--hids");
  const fixture = value("--from-fixture");
  if (list && fixture) throw new Error("Use either --hids or --from-fixture, not both");
  if (list) {
    const hids = list.split(",").map((s) => Number(s.trim()));
    if (hids.length === 0 || hids.some((n) => !Number.isInteger(n) || n <= 0)) throw new Error("--hids must be a comma-separated list of positive integers");
    return [...new Set(hids)];
  }
  if (fixture) {
    if (!/^[a-z0-9-]+$/i.test(fixture)) throw new Error("--from-fixture takes a fixture name such as serp-region");
    const data = JSON.parse(readFileSync(`tests/fixtures/etg/${fixture}.json`, "utf8")) as { hotels?: { hid?: unknown }[] };
    const hids = (data.hotels ?? []).map((h) => h.hid);
    if (hids.some((n) => typeof n !== "number")) throw new Error(`fixture ${fixture} has hotels without a numeric hid`);
    return [...new Set(hids as number[])];
  }
  throw new Error("Pass --hids 1,2,3 or --from-fixture serp-region");
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
// 30 requests per 60 s per endpoint: stay well inside it.
const PAUSE_MS = 2_500;

const hids = resolveHids();
console.log(`${dryRun ? "[dry run] " : ""}syncing ${hids.length} hotel(s)`);

const syncedAt = new Date().toISOString();
const raws: unknown[] = [];
const reviews: Awaited<ReturnType<typeof fetchHotelReviewSummaries>> = [];
const batches = chunk(hids, CONTENT_BATCH_SIZE);
for (const [i, batch] of batches.entries()) {
  if (i > 0) await sleep(PAUSE_MS);
  raws.push(...(await fetchHotelContent(batch)));
  await sleep(PAUSE_MS);
  reviews.push(...(await fetchHotelReviewSummaries(batch)));
}

const mapped = mapEtgHotels(raws, syncedAt, reviews);
const returned = new Set(raws.map((r) => (r as { hid?: unknown }).hid));
const missing = hids.filter((h) => !returned.has(h));
console.log(`fetched ${raws.length}, mapped ${mapped.hotels.length}, skipped invalid ${mapped.skippedInvalid}, skipped closed or deleted ${mapped.skippedClosed}, not returned by ETG ${missing.length}`);
console.log(`with coordinates ${mapped.hotels.filter((h) => h.latitude !== null && h.longitude !== null).length}, with star rating ${mapped.hotels.filter((h) => h.starRating !== null).length}, with review rating ${mapped.hotels.filter((h) => h.reviewRating !== null).length}, with images ${mapped.hotels.filter((h) => h.images.length > 0).length}`);

if (dryRun) {
  const sample = mapped.hotels.find((h) => h.images.length > 0) ?? mapped.hotels[0];
  if (sample) {
    const shape = Object.entries(sample).map(([k, v]) => `${k}:${Array.isArray(v) ? `array(${v.length})` : v === null ? "null" : typeof v}`);
    console.log(`sample hotel ${sample.hid} fields: ${shape.join(", ")}`);
  }
  console.log("[dry run] nothing written");
} else {
  const { upsertHotels, recordMissing, saveDictionaries } = await import("../src/lib/content/store");
  await upsertHotels(mapped.hotels);
  console.log(`upserted ${mapped.hotels.length} hotel row(s)`);
  if (missing.length > 0) {
    await recordMissing(missing);
    console.log(`recorded ${missing.length} missing hid(s)`);
  }
  if (!skipDictionaries) {
    const dict = await fetchStaticDictionaries();
    await saveDictionaries(dict);
    console.log(`saved dictionaries (taxes ${Object.keys(dict.taxNames).length}, meals ${Object.keys(dict.mealNames).length})`);
  }
}
