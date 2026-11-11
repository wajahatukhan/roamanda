import { zoneLabel } from "./time-zone";

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

/** ETG timestamps carry no offset and are UTC. Throws on anything unparseable. */
export function parseTimestamp(value: string): number {
  if (!ISO.test(value)) throw new Error(`Unparseable cancellation timestamp: ${value}`);
  let v = value;
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(v)) v += "Z";
  else v = v.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const [, y, mo, d, h, mi, s] = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(v) as RegExpExecArray;
  const check = new Date(Date.UTC(+y!, +mo! - 1, +d!, +h!, +mi!, +(s ?? 0)));
  const calendarOk =
    check.getUTCFullYear() === +y! && check.getUTCMonth() === +mo! - 1 && check.getUTCDate() === +d! &&
    check.getUTCHours() === +h! && check.getUTCMinutes() === +mi! && check.getUTCSeconds() === +(s ?? 0);
  const ms = Date.parse(v);
  if (!calendarOk || Number.isNaN(ms)) throw new Error(`Unparseable cancellation timestamp: ${value}`);
  return ms;
}

function zoneParts(ms: number, timeZone: string, options: Intl.DateTimeFormatOptions, locale: string) {
  const parts = new Intl.DateTimeFormat(locale, { timeZone, ...options }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return get;
}

/** "27 June", with the year only when it is not the current year in that zone. */
export function formatDate(ms: number, now: Date, timeZone: string): string {
  const d = zoneParts(ms, timeZone, { day: "numeric", month: "long", year: "numeric" }, "en-GB");
  const nowYear = zoneParts(now.getTime(), timeZone, { year: "numeric" }, "en-GB")("year");
  const base = `${d("day")} ${d("month")}`;
  return d("year") === nowYear ? base : `${base} ${d("year")}`;
}

/** "11:59 pm" */
export function formatTime(ms: number, timeZone: string): string {
  const t = zoneParts(ms, timeZone, { hour: "numeric", minute: "2-digit", hourCycle: "h12" }, "en-US");
  return `${t("hour")}:${t("minute")} ${t("dayPeriod").toLowerCase()}`;
}

/** "27 June, 11:59 pm Dubai time": date, time and the name of the zone they are shown in. */
export function formatWhen(ms: number, now: Date, timeZone: string): string {
  return `${formatDate(ms, now, timeZone)}, ${formatTime(ms, timeZone)} ${zoneLabel(timeZone)}`;
}
