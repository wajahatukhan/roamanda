import "server-only";
import type { z } from "zod";
import { getEnv } from "@/env";
import { EtgError } from "./errors";

const DEFAULT_TIMEOUT_MS = 30_000;
/** Waits before retry 1 and retry 2 (HTTP 5xx only). */
const DEFAULT_RETRY_DELAYS_MS = [300, 900];

export type EtgRequestOptions<T> = {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  schema: z.ZodType<T>;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  /** Test seam: overrides the production backoff. */
  retryDelaysMs?: number[];
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Envelope = { status?: string; error?: unknown; data?: unknown; debug?: unknown };

async function attempt<T>(opts: EtgRequestOptions<T>): Promise<T> {
  const env = getEnv();
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = new Headers({ Authorization: "Basic " + btoa(`${env.ETG_KEY_ID}:${env.ETG_API_KEY}`) });
  const init: RequestInit = { method: opts.method, headers, signal: controller.signal };
  if (opts.method === "POST") {
    headers.set("Content-Type", "application/json");
    init.body = JSON.stringify(opts.body ?? {});
  }

  try {
    let res: Response;
    try {
      res = await fetchImpl(env.ETG_BASE_URL + opts.path, init);
    } catch (e) {
      if (controller.signal.aborted) {
        throw new EtgError({ code: "timeout", httpStatus: 0, retryable: true, message: `ETG request timed out after ${timeoutMs} ms` });
      }
      throw new EtgError({ code: "network_error", httpStatus: 0, retryable: true, message: String(e), detail: e });
    }

    if (res.status >= 500) {
      throw new EtgError({ code: "server_error", httpStatus: res.status, retryable: true });
    }

    let json: Envelope;
    try {
      json = (await res.json()) as Envelope;
    } catch (e) {
      throw new EtgError({ code: "unexpected_response", httpStatus: res.status, retryable: false, message: "Response body was not JSON", detail: e });
    }
    if (typeof json !== "object" || json === null) {
      throw new EtgError({ code: "unexpected_response", httpStatus: res.status, retryable: false, detail: json });
    }

    if (json.status === "error" || !res.ok) {
      const code = typeof json.error === "string" && json.error ? json.error : "unexpected_response";
      throw new EtgError({ code, httpStatus: res.status, retryable: res.status === 429, detail: json.debug });
    }

    const parsed = opts.schema.safeParse(json.data);
    if (!parsed.success) {
      throw new EtgError({
        code: "unexpected_response",
        httpStatus: res.status,
        retryable: false,
        message: "ETG response did not match the expected schema",
        detail: parsed.error.issues,
      });
    }
    return parsed.data;
  } finally {
    clearTimeout(timer);
  }
}

/** Calls the ETG API and returns the schema-validated `data` field. Retries HTTP 5xx only. */
export async function etgRequest<T>(opts: EtgRequestOptions<T>): Promise<T> {
  const delays = opts.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  for (let i = 0; ; i++) {
    try {
      return await attempt(opts);
    } catch (e) {
      const is5xx = e instanceof EtgError && e.httpStatus >= 500;
      if (!is5xx || i >= delays.length) throw e;
      await sleep(delays[i] ?? 0);
    }
  }
}
