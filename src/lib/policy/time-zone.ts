import tzlookup from "tz-lookup";

/** IANA time zone for a coordinate. */
export function hotelTimeZone(lat: number, lng: number): string {
  return tzlookup(lat, lng);
}

/** U+2212, the typographic minus, used in every negative offset label. */
export const MINUS = "−";

const ETC_UTC = /^Etc\/(UTC|UCT|GMT|GMT[+-]?0|Greenwich|Universal|Zulu)$/;
const ETC_OFFSET = /^Etc\/GMT([+-])(\d{1,2})$/;

/**
 * "Asia/Dubai" -> "Dubai time"; "UTC" -> "UTC". The POSIX-style Etc zones have the sign inverted ("Etc/GMT+4" is
 * four hours behind UTC), so they are named by their real offset: "Etc/GMT+4" -> "UTC−4", "Etc/GMT-3" -> "UTC+3".
 */
export function zoneLabel(timeZone: string): string {
  if (timeZone === "UTC" || ETC_UTC.test(timeZone)) return "UTC";
  const etc = ETC_OFFSET.exec(timeZone);
  if (etc) return `UTC${etc[1] === "+" ? MINUS : "+"}${Number(etc[2])}`;
  const city = timeZone.split("/").pop() ?? timeZone;
  return `${city.replace(/_/g, " ")} time`;
}
