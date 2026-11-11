import { z } from "zod";
import { resetEnvCache } from "@/env";
import { etgRequest } from "@/lib/etg/client";
import { EtgError } from "@/lib/etg/errors";

beforeEach(() => {
  vi.stubEnv("ETG_KEY_ID", "id");
  vi.stubEnv("ETG_API_KEY", "key");
  vi.stubEnv("ETG_MODE", "live");
  vi.stubEnv("ETG_BASE_URL", "https://etg.test");
  vi.stubEnv("SUPABASE_URL", "https://supabase.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
  resetEnvCache();
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
});

const noWait = [0, 0];

test("sends Basic auth, JSON body to base URL + path, and returns parsed data", async () => {
  const fetchImpl = vi.fn(async (_u: RequestInfo | URL, init?: RequestInit) => {
    expect(new Headers(init!.headers).get("authorization")).toBe("Basic " + btoa("id:key"));
    expect(new Headers(init!.headers).get("content-type")).toBe("application/json");
    expect(init!.body).toBe(JSON.stringify({ a: 1 }));
    return Response.json({ status: "ok", error: null, data: { n: 1 }, debug: {} });
  });
  const out = await etgRequest({
    method: "POST",
    path: "/api/b2b/v3/x/",
    body: { a: 1 },
    schema: z.object({ n: z.number() }),
    fetchImpl,
  });
  expect(out).toEqual({ n: 1 });
  expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://etg.test/api/b2b/v3/x/");
});

test("GET sends no body", async () => {
  const fetchImpl = vi.fn(async (_u: RequestInfo | URL, init?: RequestInit) => {
    expect(init!.method).toBe("GET");
    expect(init!.body).toBeUndefined();
    return Response.json({ status: "ok", error: null, data: { n: 2 } });
  });
  expect(await etgRequest({ method: "GET", path: "/x", schema: z.object({ n: z.number() }), fetchImpl })).toEqual({ n: 2 });
});

test("maps an error envelope to EtgError", async () => {
  const fetchImpl = async () =>
    Response.json({ status: "error", error: "invalid_params", data: null, debug: { validation_error: "checkin" } }, { status: 400 });
  const err = await etgRequest({ method: "POST", path: "/x", schema: z.any(), fetchImpl }).catch((e) => e);
  expect(err).toBeInstanceOf(EtgError);
  expect(err).toMatchObject({ code: "invalid_params", httpStatus: 400, retryable: false });
  expect(err.detail).toEqual({ validation_error: "checkin" });
});

test("maps an error envelope delivered with HTTP 200", async () => {
  const fetchImpl = async () => Response.json({ status: "error", error: "no_available_rates", data: null, debug: {} });
  await expect(etgRequest({ method: "POST", path: "/x", schema: z.any(), fetchImpl })).rejects.toMatchObject({
    code: "no_available_rates",
    httpStatus: 200,
    retryable: false,
  });
});

test("retries 5xx up to 2 more times then throws retryable", async () => {
  const fetchImpl = vi.fn(async () => new Response("", { status: 502 }));
  await expect(
    etgRequest({ method: "POST", path: "/x", schema: z.any(), fetchImpl, retryDelaysMs: noWait }),
  ).rejects.toMatchObject({ retryable: true, httpStatus: 502 });
  expect(fetchImpl).toHaveBeenCalledTimes(3);
});

test("recovers when a retry succeeds", async () => {
  let calls = 0;
  const fetchImpl = vi.fn(async () =>
    ++calls < 3 ? new Response("", { status: 503 }) : Response.json({ status: "ok", error: null, data: { n: 3 } }),
  );
  const out = await etgRequest({ method: "POST", path: "/x", schema: z.object({ n: z.number() }), fetchImpl, retryDelaysMs: noWait });
  expect(out).toEqual({ n: 3 });
  expect(fetchImpl).toHaveBeenCalledTimes(3);
});

test("production backoff is 300 ms then 900 ms", async () => {
  vi.useFakeTimers();
  try {
    const fetchImpl = vi.fn(async () => new Response("", { status: 500 }));
    const p = etgRequest({ method: "POST", path: "/x", schema: z.any(), fetchImpl }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(299);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(899);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(await p).toBeInstanceOf(EtgError);
  } finally {
    vi.useRealTimers();
  }
});

test("429 is not retried and is marked retryable", async () => {
  const fetchImpl = vi.fn(async () =>
    Response.json({ status: "error", error: "endpoint_exceeded_limit", data: null, debug: {} }, { status: 429 }),
  );
  await expect(
    etgRequest({ method: "POST", path: "/x", schema: z.any(), fetchImpl, retryDelaysMs: noWait }),
  ).rejects.toMatchObject({ code: "endpoint_exceeded_limit", httpStatus: 429, retryable: true });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

test("aborts after timeoutMs with code 'timeout'", async () => {
  const fetchImpl = vi.fn(
    (_u: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_res, rej) => {
        init!.signal!.addEventListener("abort", () => rej(init!.signal!.reason));
      }),
  );
  await expect(
    etgRequest({ method: "POST", path: "/x", schema: z.any(), fetchImpl, timeoutMs: 20 }),
  ).rejects.toMatchObject({ code: "timeout", retryable: true });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

test("schema mismatch throws code 'unexpected_response'", async () => {
  const fetchImpl = async () => Response.json({ status: "ok", error: null, data: { n: "a" } });
  await expect(
    etgRequest({ method: "POST", path: "/x", schema: z.object({ n: z.number() }), fetchImpl }),
  ).rejects.toMatchObject({ code: "unexpected_response", retryable: false });
});

test("non-JSON body on a non-5xx response is 'unexpected_response'", async () => {
  const fetchImpl = async () => new Response("<html>nope</html>", { status: 200 });
  await expect(etgRequest({ method: "POST", path: "/x", schema: z.any(), fetchImpl })).rejects.toMatchObject({
    code: "unexpected_response",
    httpStatus: 200,
  });
});
