export type ApiErrorKind = 'abort' | 'http' | 'network' | 'parse' | 'timeout';

type ApiErrorOptions = {
  cause?: unknown;
  kind: ApiErrorKind;
  status?: number;
};

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  override readonly cause?: unknown;

  constructor(message: string, options: ApiErrorOptions) {
    super(message);
    this.name = 'ApiError';
    this.cause = options.cause;
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
  fallback = 'Ocurrió un error. Intenta de nuevo.',
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
  }

  if (error instanceof UserFacingError) return error.message;

  return fallback;
}

export class UserFacingError extends Error {
  override name = 'UserFacingError';
}
