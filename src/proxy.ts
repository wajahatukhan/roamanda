import { NextResponse, type NextRequest } from "next/server";
import { hotelExists } from "@/lib/content/store";
import { MISSING_HOTEL_HEADER } from "@/lib/hotel/missing";

const HID = /^[1-9]\d{0,11}$/;

/**
 * Hotel pages stream, and a streamed response starts with status 200, so the page itself cannot answer 404.
 * This runs first and answers 404 for a bad hotel id (the plain 404 page) and for a hotel with no stored
 * content (the "we don't have details" page). Rewriting to a path that matches no route is what gives the 404 status.
 * It only reads (an id-only, cached, 300 ms bounded existence check) and never writes. When the answer is unknown
 * it lets the request through: the page handles a missing hotel itself, and this must never slow or fail a page.
 */
export async function proxy(request: NextRequest) {
  const hid = request.nextUrl.pathname.split("/")[2] ?? "";
  const notFound = (marked: boolean) => {
    const headers = new Headers(request.headers);
    if (marked) headers.set(MISSING_HOTEL_HEADER, "1");
    else headers.delete(MISSING_HOTEL_HEADER);
    return NextResponse.rewrite(new URL("/hotel-not-found", request.url), { request: { headers } });
  };

  if (!HID.test(hid)) return notFound(false);
  if ((await hotelExists(Number(hid))) === false) return notFound(true);
  // A visitor must not be able to set the marker themselves.
  if (request.headers.has(MISSING_HOTEL_HEADER)) {
    const headers = new Headers(request.headers);
    headers.delete(MISSING_HOTEL_HEADER);
    return NextResponse.next({ request: { headers } });
  }
  return NextResponse.next();
}

/** Server-action POSTs carry the `next-action` header; the matcher's `missing` option keeps them out of the proxy. */
export const config = { matcher: [{ source: "/hotel/:hid", missing: [{ type: "header", key: "next-action" }] }] };
