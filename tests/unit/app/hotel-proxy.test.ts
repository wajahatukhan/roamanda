import { NextRequest } from "next/server";
import { config, proxy } from "@/proxy";

const hotelExists = vi.fn();
vi.mock("@/lib/content/store", () => ({ hotelExists: (...a: unknown[]) => hotelExists(...a) }));

const req = (path: string, headers: Record<string, string> = {}) => new NextRequest(`http://localhost:3100${path}`, { headers });
const rewritten = (res: Response) => res.headers.get("x-middleware-rewrite");

beforeEach(() => {
  hotelExists.mockReset();
});

describe("proxy", () => {
  test("an unknown hotel is rewritten to the 404 page", async () => {
    hotelExists.mockResolvedValue(false);
    const res = await proxy(req("/hotel/99999999"));
    expect(rewritten(res)).toContain("/hotel-not-found");
    expect(res.headers.get("x-middleware-request-x-missing-hotel")).toBe("1");
  });

  test("a known hotel, or an unknown answer, falls through to the page", async () => {
    for (const answer of [true, null]) {
      hotelExists.mockResolvedValue(answer);
      const res = await proxy(req("/hotel/10004834"));
      expect(rewritten(res)).toBeNull();
      expect(res.headers.get("x-middleware-next")).toBe("1");
    }
  });

  test("a bad id is a plain 404 without asking the store", async () => {
    const res = await proxy(req("/hotel/abc"));
    expect(rewritten(res)).toContain("/hotel-not-found");
    expect(res.headers.get("x-middleware-request-x-missing-hotel")).toBeNull();
    expect(hotelExists).not.toHaveBeenCalled();
  });

  test("a visitor-sent marker header is dropped", async () => {
    hotelExists.mockResolvedValue(true);
    const res = await proxy(req("/hotel/10004834", { "x-missing-hotel": "1" }));
    expect(res.headers.get("x-middleware-request-x-missing-hotel")).toBeNull();
  });

  test("the matcher skips server-action requests", () => {
    expect(config.matcher).toEqual([{ source: "/hotel/:hid", missing: [{ type: "header", key: "next-action" }] }]);
  });
});
