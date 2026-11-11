import "server-only";
import { getEnv } from "@/env";
import { etgRequest } from "./client";
import {
  HotelPageData,
  MulticompleteData,
  SearchRegionData,
  type Rate,
  type StayQuery,
} from "./schemas";

const LANGUAGE = "en";

// Dynamic imports keep the recorded JSON out of the live-mode path; the bundler still includes them.
const hotelPageFixtures: Record<number, () => Promise<unknown>> = {
  10004834: async () => (await import("../../../tests/fixtures/etg/hp-10004834.json")).default,
  8819557: async () => (await import("../../../tests/fixtures/etg/hp-8819557.json")).default,
};
const DEFAULT_HOTEL_PAGE_FIXTURE = 10004834;

const isFixtureMode = () => getEnv().ETG_MODE === "fixture";

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

export async function searchRegion(regionId: number, q: StayQuery): Promise<SearchRegionData["hotels"]> {
  if (isFixtureMode()) {
    return SearchRegionData.parse((await import("../../../tests/fixtures/etg/serp-region.json")).default).hotels;
  }
  const data = await etgRequest({
    method: "POST",
    path: "/api/b2b/v3/search/serp/region/",
    body: { ...stayBody(q), region_id: regionId },
    schema: SearchRegionData,
  });
  return data.hotels;
}

export async function hotelPage(hid: number, q: StayQuery): Promise<Rate[]> {
  if (isFixtureMode()) {
    const load = hotelPageFixtures[hid] ?? hotelPageFixtures[DEFAULT_HOTEL_PAGE_FIXTURE]!;
    return HotelPageData.parse(await load()).hotels[0]?.rates ?? [];
  }
  const data = await etgRequest({
    method: "POST",
    path: "/api/b2b/v3/search/hp/",
    body: { ...stayBody(q), hid },
    schema: HotelPageData,
  });
  return data.hotels.find((h) => h.hid === hid)?.rates ?? [];
}
