import { humanize } from "./format";

export type PolicyGroup = { key: string; title: string; items: string[] };
export type PolicyData = { groups: PolicyGroup[]; extra: string[] };

const TITLES: Record<string, string> = {
  add_fee: "Extra fees",
  check_in_check_out: "Check-in and check-out",
  children: "Children",
  children_meal: "Children's meals",
  cot: "Cots",
  deposit: "Deposits",
  extra_bed: "Extra beds",
  internet: "Internet",
  meal: "Meals",
  no_show: "No-show",
  parking: "Parking",
  pets: "Pets",
  shuttle: "Shuttle",
  visa: "Visa support",
};

/** Words the supplier uses for "nothing to say"; a group made only of these is not populated. */
const EMPTY = new Set(["", "unspecified", "unknown", "none", "null"]);

function scalar(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return EMPTY.has(t.toLowerCase()) ? null : t;
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
}

/** Plain text for a value of any shape. Objects and arrays become "key: value" text. Never returns markup. */
function textOf(v: unknown, depth = 0): string | null {
  const s = scalar(v);
  if (s !== null) return /^[a-z0-9]+(_[a-z0-9]+)+$/i.test(s) ? humanize(s).toLowerCase() : s;
  if (Array.isArray(v)) {
    const parts = v.map((x) => textOf(x, depth + 1)).filter((x): x is string => x !== null);
    return parts.length ? parts.join(", ") : null;
  }
  if (v && typeof v === "object") {
    if (depth > 3) return null;
    const parts = Object.entries(v as Record<string, unknown>)
      .map(([k, x]) => {
        const t = textOf(x, depth + 1);
        return t === null ? null : `${humanize(k)}: ${t}`;
      })
      .filter((x): x is string => x !== null);
    return parts.length ? parts.join("; ") : null;
  }
  return null;
}

/** The key that names what an entry is about (a fee type, a meal type...). It leads the entry when present. */
const LEAD_KEYS = ["fee_type", "check_in_check_out_type", "deposit_type", "meal_type", "internet_type", "territory_type", "pets_type", "shuttle_type"];

/** One entry of a group, as readable pieces. A price and its currency read as one amount; an age range reads as "Ages 0 to 3". */
function itemText(item: unknown): string | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) return textOf(item);
  const o = item as Record<string, unknown>;
  const used = new Set<string>(["currency"]); // currency is folded into the price below
  const pct = scalar(o.pricing_method) === "percent";

  let lead: string | null = null;
  for (const key of LEAD_KEYS) {
    const t = textOf(o[key]);
    if (t !== null) {
      lead = humanize(t);
      used.add(key);
      break;
    }
  }
  const from = scalar(o.age_start);
  const to = scalar(o.age_end);
  if (from !== null && to !== null) {
    used.add("age_start").add("age_end");
    lead = [lead, `Ages ${from} to ${to}`].filter(Boolean).join(", ");
  }

  const pieces: string[] = [];
  for (const [key, value] of Object.entries(o)) {
    if (used.has(key)) continue;
    const t = textOf(value);
    if (t === null) continue;
    if (key === "price") {
      const currency = scalar(o.currency);
      pieces.push(`Price: ${pct ? `${t}%` : currency ? `${t} ${currency}` : t}`);
    } else if (key === "pricing_method" && pct) {
      continue;
    } else {
      pieces.push(`${humanize(key)}: ${t}`);
    }
  }
  if (pieces.length === 0) return lead;
  return lead ? `${lead} \u2014 ${pieces.join(" \u00b7 ")}` : pieces.join(" \u00b7 ");
}

/**
 * Every populated group of the stored policy data, readable as text. Known groups get a plain heading and any
 * group with an unfamiliar name or shape still comes through as key/value text, so nothing is dropped.
 */
export function policyGroups(struct: Record<string, unknown> | null | undefined): PolicyGroup[] {
  if (!struct || typeof struct !== "object") return [];
  const groups: PolicyGroup[] = [];
  for (const [key, value] of Object.entries(struct)) {
    const entries = Array.isArray(value) ? value : [value];
    const items = entries.map(itemText).filter((x): x is string => x !== null);
    if (items.length === 0) continue;
    groups.push({ key, title: Object.hasOwn(TITLES, key) ? TITLES[key]! : humanize(key), items });
  }
  return groups;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ndash: "–", mdash: "—" };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1]?.toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return Object.hasOwn(ENTITIES, body.toLowerCase()) ? ENTITIES[body.toLowerCase()]! : whole;
  });
}

/**
 * The supplier's extra policy text arrives as HTML. This reduces it to plain lines (list items get a bullet) so
 * the page can show it as text. The result is never passed to an HTML sink.
 */
export function htmlToLines(html: string | null | undefined): string[] {
  if (!html) return [];
  const text = html
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<li\b[^>]*>/gi, "\n• ")
    .replace(/<\/?(p|div|ul|ol|h[1-6]|tr|table)\b[^>]*>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "");
  return decodeEntities(text)
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l && l !== "•");
}

export function policyData(struct: Record<string, unknown> | null | undefined, extraInfo: string | null | undefined): PolicyData {
  return { groups: policyGroups(struct), extra: htmlToLines(extraInfo) };
}
