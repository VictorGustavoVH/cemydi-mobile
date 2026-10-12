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

export function getFriendlyErrorMessage(
  error: unknown,
  fallback = 'Ocurrió un problema al obtener los datos. Intenta de nuevo.',
): string {
  if (isApiError(error)) {
    if (error.kind === 'network') {
      return 'No fue posible conectar con el servidor. Comprueba tu conexión e intenta de nuevo.';
    }
    if (error.kind === 'timeout') {
      return 'La solicitud tardó demasiado tiempo en responder. Intenta de nuevo.';
    }
    if (error.kind === 'abort') {
      return 'La operación fue cancelada.';
    }
    if (error.kind === 'parse') {
      return 'Ocurrió un problema al procesar la información. Intenta de nuevo.';
    }
    if (error.kind === 'http') {
      if (error.status === 404) {
        return 'No encontramos la información solicitada.';
      }
      if (error.status !== undefined && error.status >= 500) {
        return 'El servicio no se encuentra disponible temporalmente. Intenta más tarde.';
      }
    }
    if (/\b(api|json|endpoint|http|status \d+)\b/i.test(error.message)) {
      return fallback;
    }
    if (error.message.trim().length > 0) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    if (/\b(api|json|endpoint|http|status \d+|network request failed)\b/i.test(error.message)) {
      return 'No fue posible conectar con el servidor. Comprueba tu conexión e intenta de nuevo.';
    }
    return error.message;
  }

  return fallback;
}
