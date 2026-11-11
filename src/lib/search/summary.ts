import type { Guests } from "@/lib/etg/schemas";

const DAY_MS = 86_400_000;
const utcDay = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function nightsBetween(checkin: string, checkout: string): number {
  return Math.round((utcDay(checkout) - utcDay(checkin)) / DAY_MS);
}

const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...o }).format(utcDay(iso));

/** "11 Dec – 13 Dec 2026 · 2 nights · 2 adults · 1 room" */
export function describeStay(q: { checkin: string; checkout: string; guests: Guests }): string {
  const adults = q.guests.reduce((n, r) => n + r.adults, 0);
  const children = q.guests.reduce((n, r) => n + r.children.length, 0);
  const year = fmt(q.checkout, { year: "numeric" });
  return [
    `${fmt(q.checkin, { day: "numeric", month: "short" })} – ${fmt(q.checkout, { day: "numeric", month: "short" })} ${year}`,
    plural(nightsBetween(q.checkin, q.checkout), "night"),
    [plural(adults, "adult"), children ? plural(children, "child", "children") : null].filter(Boolean).join(", "),
    plural(q.guests.length, "room"),
  ].join(" · ");
}
