/** "14:00:00" or "14:00" -> "2:00 pm". Anything else comes back unchanged, so odd supplier text still shows. */
export function formatClock(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!m) return value.trim() || null;
  const h = Number(m[1]);
  const min = m[2]!;
  if (h > 23 || Number(min) > 59) return value.trim();
  return `${h % 12 === 0 ? 12 : h % 12}:${min} ${h < 12 ? "am" : "pm"}`;
}

/** "bedroom_view" -> "Bedroom view". */
export function humanize(key: string): string {
  const words = key.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "";
}
