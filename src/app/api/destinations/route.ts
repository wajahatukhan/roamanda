import { getEnv } from "@/env";
import { EtgError } from "@/lib/etg/errors";
import { multicomplete } from "@/lib/etg/search";
import { MIN_QUERY_LENGTH, type DestinationsResponse } from "@/lib/search/destinations";

const MAX_PER_GROUP = 6;
/** Longer queries are not destination names; they get no suggestions and never reach the supplier. */
export const MAX_QUERY_LENGTH = 80;

export async function GET(request: Request): Promise<Response> {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < MIN_QUERY_LENGTH || q.length > MAX_QUERY_LENGTH) {
    return Response.json({ regions: [], hotels: [] } satisfies DestinationsResponse);
  }
  try {
    const data = await multicomplete(q);
    // Fixture mode replays one recorded response, so narrow it to what the query would plausibly match.
    const needle = q.toLowerCase();
    const matches = (name: string) => getEnv().ETG_MODE !== "fixture" || name.toLowerCase().includes(needle);
    const body: DestinationsResponse = {
      regions: data.regions
        .filter((r) => matches(r.name))
        .slice(0, MAX_PER_GROUP)
        .map((r) => ({ id: r.id, name: r.name, type: r.type, countryCode: r.country_code })),
      hotels: data.hotels
        .filter((h) => matches(h.name))
        .slice(0, MAX_PER_GROUP)
        .map((h) => ({ hid: h.hid, name: h.name })),
    };
    // Our ETG key allows 30 suggestion requests per 60 s; let the browser reuse repeated queries.
    return Response.json(body, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (error) {
    if (error instanceof EtgError) {
      return Response.json({ regions: [], hotels: [], error: "unavailable" } satisfies DestinationsResponse, { status: 502 });
    }
    throw error;
  }
}
