"use server";

import { cookies } from "next/headers";
import { normalizeResidency } from "./countries";

const COOKIE = "residency";
const ONE_YEAR = 60 * 60 * 24 * 365;

/** The passport country (lower-case ISO alpha-2), or null when unset or the stored value is invalid. */
export async function getResidency(): Promise<string | null> {
  return normalizeResidency((await cookies()).get(COOKIE)?.value);
}

/** Stores the passport country. Rejects anything that is not a known country code. */
export async function setResidency(code: string): Promise<{ ok: boolean }> {
  const valid = normalizeResidency(code);
  if (!valid) return { ok: false };
  (await cookies()).set(COOKIE, valid, { maxAge: ONE_YEAR, path: "/", sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" });
  return { ok: true };
}
