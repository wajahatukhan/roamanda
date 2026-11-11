import tzlookup from "tz-lookup";

/** IANA time zone for a coordinate. */
export function hotelTimeZone(lat: number, lng: number): string {
  return tzlookup(lat, lng);
}

/** "Asia/Dubai" -> "Dubai time"; "UTC" -> "UTC". */
export function zoneLabel(timeZone: string): string {
  if (timeZone === "UTC") return "UTC";
  const city = timeZone.split("/").pop() ?? timeZone;
  return `${city.replace(/_/g, " ")} time`;
}
