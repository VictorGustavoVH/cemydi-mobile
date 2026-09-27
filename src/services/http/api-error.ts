export type ApiErrorKind = 'abort' | 'http' | 'network' | 'parse' | 'timeout';

type ApiErrorOptions = {
  cause?: unknown;
  data?: unknown;
  kind: ApiErrorKind;
  status?: number;
};

export class ApiError extends Error {
  readonly data?: unknown;
  readonly kind: ApiErrorKind;
  readonly status?: number;
  override readonly cause?: unknown;

  constructor(message: string, options: ApiErrorOptions) {
    super(message);
    this.name = 'ApiError';
    this.cause = options.cause;
    this.data = options.data;
    this.kind = options.kind;
    this.status = options.status;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isRetryableApiError(error: unknown): boolean {
  if (!isApiError(error)) {
    return false;
  }

  if (error.kind === 'network' || error.kind === 'timeout') {
    return true;
  }

  return error.kind === 'http' && error.status !== undefined && error.status >= 500;
}
