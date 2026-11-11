import type { Guests } from "@/lib/etg/schemas";
import { decodeRooms, LIMITS } from "./params";

type RawParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export type InitialFormValues = {
  destination: { kind: "region"; id: number; name: string } | null;
  range: { from: Date; to: Date } | undefined;
  rooms: Guests | undefined;
};

function localDate(s: string | undefined): Date | null {
  const m = s ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(s) : null;
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d : null;
}

/** Whatever part of the URL is usable as form values; the rest is dropped so the form never shows nonsense. */
export function initialFormValues(sp: RawParams): InitialFormValues {
  const regionRaw = first(sp.region);
  const name = first(sp.name)?.trim();
  const id = regionRaw && /^\d{1,12}$/.test(regionRaw) ? Number(regionRaw) : 0;
  const from = localDate(first(sp.in));
  const to = localDate(first(sp.out));
  const roomsRaw = first(sp.rooms);
  const decoded = roomsRaw ? decodeRooms(roomsRaw) : null;
  const roomsOk =
    decoded !== null &&
    decoded.length <= LIMITS.maxRooms &&
    decoded.every((r) => r.adults >= 1 && r.adults <= LIMITS.maxAdults && r.children.length <= LIMITS.maxChildren && r.children.every((a) => a <= LIMITS.maxChildAge));
  return {
    destination: id && name ? { kind: "region", id, name } : null,
    range: from && to && to > from ? { from, to } : undefined,
    rooms: roomsOk ? decoded : undefined,
  };
}
