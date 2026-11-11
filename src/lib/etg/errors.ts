import "server-only";

export class EtgError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly retryable: boolean;
  readonly detail?: unknown;

  constructor(opts: { code: string; httpStatus: number; retryable: boolean; message?: string; detail?: unknown }) {
    super(opts.message ?? opts.code);
    this.name = "EtgError";
    this.code = opts.code;
    this.httpStatus = opts.httpStatus;
    this.retryable = opts.retryable;
    this.detail = opts.detail;
  }
}
