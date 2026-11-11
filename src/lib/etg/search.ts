import "server-only";
import { getEnv } from "@/env";
import { z } from "zod";
import { etgRequest } from "./client";
import { EtgError } from "./errors";
import { MulticompleteData, Rate, type StayQuery } from "./schemas";

const LANGUAGE = "en";

// Dynamic imports keep the recorded JSON out of the live-mode path; the bundler still includes them.
const hotelPageFixtures: Record<number, () => Promise<unknown>> = {
  10004834: async () => (await import("../../../tests/fixtures/etg/hp-10004834.json")).default,
  8819557: async () => (await import("../../../tests/fixtures/etg/hp-8819557.json")).default,
};
const DEFAULT_HOTEL_PAGE_FIXTURE = 10004834;

const isFixtureMode = () => getEnv().ETG_MODE === "fixture";

// Envelope is strict; each rate is validated on its own so one bad rate does not reject the response.
const LooseHotelsResponse = z.object({ hotels: z.array(z.unknown()) }).loose();
const HotelShell = z.object({ hid: z.number(), rates: z.array(z.unknown()) });

export type LenientHotels = {
  hotels: { hid: number; rates: Rate[] }[];
  droppedRates: number;
  droppedHotels: number;
};

/**
 * Parses `{ hotels: [{ hid, rates }] }`, dropping invalid rates and invalid hotels. Throws EtgError
 * `unexpected_response` if the envelope is broken, or if rates were present and all were invalid.
 * Logs one warning with counts and the first issue path (never payload contents).
 */
export function parseHotelsLenient(data: unknown): LenientHotels {
  const env = LooseHotelsResponse.safeParse(data);
  if (!env.success) {
    throw new EtgError({ code: "unexpected_response", httpStatus: 200, retryable: false, message: "ETG response did not match the expected schema", detail: env.error.issues });
  }
  const hotels: LenientHotels["hotels"] = [];
  let droppedRates = 0, droppedHotels = 0, totalRates = 0;
  let firstPath: string | undefined;
  const note = (issues: z.core.$ZodIssue[]) => { firstPath ??= (issues[0]?.path ?? []).join(".") || "(root)"; };
  for (const raw of env.data.hotels) {
    const shell = HotelShell.safeParse(raw);
    if (!shell.success) { droppedHotels++; note(shell.error.issues); continue; }
    const rates: Rate[] = [];
    for (const r of shell.data.rates) {
      totalRates++;
      const parsed = Rate.safeParse(r);
      if (parsed.success) rates.push(parsed.data);
      else { droppedRates++; note(parsed.error.issues); }
    }
    hotels.push({ hid: shell.data.hid, rates });
  }
  if (droppedRates > 0 || droppedHotels > 0) {
    console.warn(`ETG response: dropped ${droppedRates} invalid rate(s) and ${droppedHotels} invalid hotel(s); first issue path: ${firstPath}`);
  }
  if (totalRates > 0 && droppedRates === totalRates) {
    throw new EtgError({ code: "unexpected_response", httpStatus: 200, retryable: false, message: "Every rate in the ETG response failed validation", detail: { droppedRates, firstPath } });
  }
  return { hotels, droppedRates, droppedHotels };
}

function stayBody(q: StayQuery) {
  return { checkin: q.checkin, checkout: q.checkout, residency: q.residency, guests: q.guests, currency: q.currency, language: LANGUAGE };
}

export async function multicomplete(query: string): Promise<MulticompleteData> {
  if (isFixtureMode()) {
    return MulticompleteData.parse((await import("../../../tests/fixtures/etg/multicomplete.json")).default);
  }
  return etgRequest({
    method: "POST",
    path: "/api/b2b/v3/search/multicomplete/",
    body: { query, language: LANGUAGE },
    schema: MulticompleteData,
  });
}

export async function searchRegion(regionId: number, q: StayQuery): Promise<LenientHotels["hotels"]> {
  if (isFixtureMode()) {
    return parseHotelsLenient((await import("../../../tests/fixtures/etg/serp-region.json")).default).hotels;
  }
  const data = await etgRequest({
    method: "POST",
    path: "/api/b2b/v3/search/serp/region/",
    body: { ...stayBody(q), region_id: regionId },
    schema: z.unknown(),
  }).then(parseHotelsLenient);
  return data.hotels;
}

export async function hotelPage(hid: number, q: StayQuery): Promise<Rate[]> {
  if (isFixtureMode()) {
    const load = hotelPageFixtures[hid] ?? hotelPageFixtures[DEFAULT_HOTEL_PAGE_FIXTURE]!;
    return parseHotelsLenient(await load()).hotels[0]?.rates ?? [];
  }
  const data = await etgRequest({
    method: "POST",
    path: "/api/b2b/v3/search/hp/",
    body: { ...stayBody(q), hid },
    schema: z.unknown(),
  }).then(parseHotelsLenient);
  return data.hotels.find((h) => h.hid === hid)?.rates ?? [];
}
