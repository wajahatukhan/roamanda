import type { Guests, StayQuery } from "@/lib/etg/schemas";

type RawParams = Record<string, string | string[] | undefined>;

export const LIMITS = { maxNights: 30, maxAdults: 6, maxChildren: 4, maxChildAge: 17, maxRooms: 9 } as const;
export const DEFAULT_GUESTS: Guests = [{ adults: 2, children: [] }];

export type ParsedSearch =
  | { ok: true; regionId: number; regionName: string; query: Omit<StayQuery, "residency"> }
  | { ok: false; problems: string[] };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const DIGITS = /^\d{1,3}$/;

export function encodeRooms(g: Guests): string {
  return g.map((r) => (r.children.length ? `${r.adults}-${r.children.join(".")}` : `${r.adults}`)).join(",");
}

/** Syntax only (returns null when malformed); limits are checked by parseSearchParams. */
export function decodeRooms(s: string): Guests | null {
  if (!s) return null;
  const rooms: Guests = [];
  for (const part of s.split(",")) {
    const [adults, kids, ...extra] = part.split("-");
    if (extra.length > 0 || adults === undefined || !DIGITS.test(adults)) return null;
    let children: number[] = [];
    if (kids !== undefined) {
      const ages = kids.split(".");
      if (!ages.every((a) => DIGITS.test(a))) return null;
      children = ages.map(Number);
    }
    rooms.push({ adults: Number(adults), children });
  }
  return rooms;
}

/** Strict YYYY-MM-DD that is a real calendar date; returns the UTC day number, or null. */
function dayNumber(s: string | undefined): number | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const t = Date.parse(`${s}T00:00:00Z`);
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== s) return null;
  return t / 86_400_000;
}

type StayParts = { checkin: string; checkout: string; guests: Guests };

/** Dates and rooms validation shared by every page that takes a stay. Adds problems through `add`. */
function checkStay(sp: RawParams, today: Date, add: (problem: string) => void): StayParts {
  const checkin = first(sp.in);
  const checkout = first(sp.out);
  const inDay = dayNumber(checkin);
  const outDay = dayNumber(checkout);
  if (inDay === null || outDay === null) {
    add("Choose your check-in and check-out dates.");
  } else {
    // One day of grace behind the UTC date, so travellers west of UTC can still book their own "today".
    const todayDay = Math.floor(today.getTime() / 86_400_000) - 1;
    if (inDay < todayDay) add("Check-in is in the past.");
    if (outDay <= inDay) add("Check-out must be after check-in.");
    else if (outDay - inDay > LIMITS.maxNights) add("Stays can be up to 30 nights.");
  }

  const roomsRaw = first(sp.rooms);
  let guests: Guests = DEFAULT_GUESTS;
  if (!roomsRaw) {
    add("Choose guests and rooms.");
  } else {
    const decoded = decodeRooms(roomsRaw);
    if (!decoded) add("Check the guest details.");
    else {
      guests = decoded;
      if (decoded.length > LIMITS.maxRooms) add("Up to 9 rooms.");
      for (const r of decoded) {
        if (r.adults < 1) add("Each room needs at least 1 adult.");
        if (r.adults > LIMITS.maxAdults) add("Up to 6 adults per room.");
        if (r.children.length > LIMITS.maxChildren) add("Up to 4 children per room.");
        if (r.children.some((a) => a > LIMITS.maxChildAge)) add("Children are aged 17 or under.");
      }
    }
  }
  return { checkin: checkin ?? "", checkout: checkout ?? "", guests };
}

export function parseSearchParams(sp: RawParams, today: Date): ParsedSearch {
  const problems: string[] = [];
  const add = (p: string) => { if (!problems.includes(p)) problems.push(p); };

  const regionRaw = first(sp.region);
  const regionId = regionRaw && /^\d{1,12}$/.test(regionRaw) ? Number(regionRaw) : 0;
  if (!regionId) add("Choose a destination.");

  const stay = checkStay(sp, today, add);

  if (problems.length > 0) return { ok: false, problems };
  return {
    ok: true,
    regionId,
    regionName: first(sp.name)?.trim() ?? "",
    query: { checkin: stay.checkin, checkout: stay.checkout, guests: stay.guests, currency: "USD" },
  };
}

export type ParsedStay =
  | { ok: true; query: Omit<StayQuery, "residency"> }
  | { ok: false; problems: string[] };

/** Dates and rooms only (no destination), with the same rules and messages as parseSearchParams. */
export function parseStayParams(sp: RawParams, today: Date): ParsedStay {
  const problems: string[] = [];
  const add = (p: string) => { if (!problems.includes(p)) problems.push(p); };
  const stay = checkStay(sp, today, add);
  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, query: { checkin: stay.checkin, checkout: stay.checkout, guests: stay.guests, currency: "USD" } };
}
