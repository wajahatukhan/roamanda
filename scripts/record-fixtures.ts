/**
 * Records raw ETG sandbox `data` payloads into tests/fixtures/etg/.
 * Run: npx tsx scripts/record-fixtures.ts   (needs live credentials in .env.local)
 * Makes each call once, sequentially, to stay well under the sandbox rate limits.
 */
import { mkdirSync, writeFileSync } from "node:fs";

process.loadEnvFile(".env.local");

const base = process.env.ETG_BASE_URL;
const keyId = process.env.ETG_KEY_ID;
const apiKey = process.env.ETG_API_KEY;
if (!base || !keyId || !apiKey) throw new Error("ETG_BASE_URL, ETG_KEY_ID and ETG_API_KEY must be set in .env.local");

const OUT = "tests/fixtures/etg";
const MAX_BYTES = 300_000;
const REGION_CANDIDATES = [2011, 2395, 2734, 6053839];
const FEATURE_HIDS = [10004834, 8819557];
const HOTELS_LIMIT = 30;

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const stay = { checkin: day(30), checkout: day(32), residency: "gb", language: "en", currency: "USD", guests: [{ adults: 2, children: [] as number[] }] };

async function call(method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
  const headers: Record<string, string> = { Authorization: "Basic " + Buffer.from(`${keyId}:${apiKey}`).toString("base64") };
  if (method === "POST") headers["Content-Type"] = "application/json";
  const res = await fetch(base + path, { method, headers, body: method === "POST" ? JSON.stringify(body ?? {}) : undefined });
  const json = (await res.json()) as { status?: string; error?: unknown; data?: unknown; debug?: unknown };
  if (json.status === "error" || !res.ok) {
    throw new Error(`${path} failed: HTTP ${res.status} error=${String(json.error)} debug=${JSON.stringify(json.debug)}`);
  }
  return json.data;
}

function write(name: string, data: unknown): void {
  const text = JSON.stringify(data, null, 2) + "\n";
  writeFileSync(`${OUT}/${name}.json`, text);
  console.log(`wrote ${name}.json (${Buffer.byteLength(text)} bytes)`);
}

type Hotel = { hid: number; rates: unknown[] };

mkdirSync(OUT, { recursive: true });

write("overview", await call("GET", "/api/b2b/v3/overview/"));
// The sandbox has a small dataset: "Berlin" returns nothing; "Paris" returns hotels and region 2734.
write("multicomplete", await call("POST", "/api/b2b/v3/search/multicomplete/", { query: "Paris", language: "en" }));

let serp: { hotels?: Hotel[]; [k: string]: unknown } | undefined;
let usedRegion: number | undefined;
for (const regionId of REGION_CANDIDATES) {
  const data = (await call("POST", "/api/b2b/v3/search/serp/region/", { ...stay, region_id: regionId, hotels_limit: HOTELS_LIMIT })) as typeof serp;
  console.log(`region ${regionId}: ${data?.hotels?.length ?? 0} hotels`);
  if (data?.hotels?.length) { serp = data; usedRegion = regionId; break; }
}
if (!serp || usedRegion === undefined) throw new Error("No sandbox region returned hotels");
if (Buffer.byteLength(JSON.stringify(serp, null, 2)) > MAX_BYTES) {
  // Deterministic trim: keep the first N hotels that fit; feature hotels keep all their rates.
  const hotels = serp.hotels ?? [];
  for (let n = hotels.length; n > 1; n--) {
    const trimmed = { ...serp, hotels: hotels.slice(0, n) };
    if (Buffer.byteLength(JSON.stringify(trimmed, null, 2)) <= MAX_BYTES) { serp = trimmed; break; }
  }
  console.log(`trimmed serp-region to ${serp.hotels?.length} hotels`);
}
write("serp-region", serp);
console.log(`USED_REGION=${usedRegion}`);

for (const hid of FEATURE_HIDS) {
  write(`hp-${hid}`, await call("POST", "/api/b2b/v3/search/hp/", { ...stay, hid }));
}
console.log(`stay: ${stay.checkin} -> ${stay.checkout}; recorded at ${new Date().toISOString()}`);
