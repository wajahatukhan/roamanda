import type { Guests } from "@/lib/etg/schemas";
import { decodeRooms, LIMITS } from "./params";
import { isoToLocalDate } from "./stay-dates";

type RawParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export type InitialFormValues = {
  destination: { kind: "region"; id: number; name: string } | null;
  /** "YYYY-MM-DD" strings, never Date objects: the browser builds its own local calendar dates from them (see stay-dates.ts). */
  range: { from: string; to: string } | undefined;
  rooms: Guests | undefined;
};

/** Whatever part of the URL is usable as form values; the rest is dropped so the form never shows nonsense. */
export function initialFormValues(sp: RawParams): InitialFormValues {
  const regionRaw = first(sp.region);
  const name = first(sp.name)?.trim();
  const id = regionRaw && /^\d{1,12}$/.test(regionRaw) ? Number(regionRaw) : 0;
  const inRaw = first(sp.in);
  const outRaw = first(sp.out);
  // Validity only; the strings themselves are passed on. "YYYY-MM-DD" strings compare in calendar order.
  const datesOk = isoToLocalDate(inRaw) !== null && isoToLocalDate(outRaw) !== null && outRaw! > inRaw!;
  const roomsRaw = first(sp.rooms);
  const decoded = roomsRaw ? decodeRooms(roomsRaw) : null;
  const roomsOk =
    decoded !== null &&
    decoded.length <= LIMITS.maxRooms &&
    decoded.every((r) => r.adults >= 1 && r.adults <= LIMITS.maxAdults && r.children.length <= LIMITS.maxChildren && r.children.every((a) => a <= LIMITS.maxChildAge));
  return {
    destination: id && name ? { kind: "region", id, name } : null,
    range: datesOk ? { from: inRaw!, to: outRaw! } : undefined,
    rooms: roomsOk ? decoded : undefined,
  };
}
