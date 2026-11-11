import "server-only";
import { recordMissing } from "@/lib/content/store";

/** Tells the store which hotels had no content. A failure here is logged and never reaches the page. */
export async function recordMissingSafely(hids: number[], record: (hids: number[]) => Promise<void> = recordMissing): Promise<void> {
  if (hids.length === 0) return;
  try {
    await record(hids);
  } catch (e) {
    console.error("Could not record hotels missing from the content store:", e instanceof Error ? e.message : "unknown error");
  }
}
