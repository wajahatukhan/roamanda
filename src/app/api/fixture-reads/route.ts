import { connection } from "next/server";
import { getEnv } from "@/env";
import { hotelPageFixtureReads, parseFixtureTag } from "@/lib/etg/fixture-reads";

/** Test aid: how many hotel-page fixture reads were made under `?tag=`. It does not exist outside fixture mode. */
export async function GET(request: Request) {
  await connection();
  const mode = getEnv().ETG_MODE;
  if (mode !== "fixture") return new Response(null, { status: 404 });
  const tag = parseFixtureTag(mode, new URL(request.url).searchParams.get("tag"));
  return Response.json({ hotelPage: hotelPageFixtureReads(mode, tag) }, { headers: { "Cache-Control": "no-store" } });
}
