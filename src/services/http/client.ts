import { env } from '@/config/env';

import { ApiError, isApiError } from './api-error';
import type { HttpClient, HttpRequestOptions } from './types';

export const DEFAULT_HTTP_TIMEOUT_MS = 15_000;

function createRequestUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    throw new ApiError('Las solicitudes deben usar rutas relativas a la API configurada.', {
      kind: 'parse',
    });
  }

  const normalizedPath = path.replace(/^\/+/, '');
  return new URL(normalizedPath, `${env.apiUrl}/`).toString();
}

function getErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object' || !('message' in data)) {
    return fallback;
  }

  const { message } = data;

  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
    return message.join(', ');
  }

  return fallback;
}

async function parseResponse(response: Response): Promise<unknown> {
  const responseText = await response.text();

  if (!responseText) {
    return undefined;
  }

  const contentType = response.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    return responseText;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch (cause) {
    if (!response.ok) {
      return responseText;
    }

    throw new ApiError('La API devolvió una respuesta JSON inválida.', {
      cause,
      kind: 'parse',
      status: response.status,
    });
  }
}

async function request<TResponse = unknown>(
  path: string,
  options: HttpRequestOptions = {},
): Promise<TResponse> {
  const {
    body,
    headers: customHeaders,
    json,
    method = 'GET',
    signal,
    timeoutMs = DEFAULT_HTTP_TIMEOUT_MS,
    ...requestInit
  } = options;
  const controller = new AbortController();
  const headers = new Headers(customHeaders);
  let timedOut = false;

  headers.set('Accept', 'application/json');

  let requestBody = body;

  if (json !== undefined) {
    headers.set('Content-Type', 'application/json');
    requestBody = JSON.stringify(json);
  }

  const abortFromExternalSignal = () => controller.abort(signal?.reason);

  if (signal?.aborted) {
    abortFromExternalSignal();
  } else {
    signal?.addEventListener('abort', abortFromExternalSignal, { once: true });
  }

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(createRequestUrl(path), {
      ...requestInit,
      body: requestBody,
      headers,
      method,
      signal: controller.signal,
    });
    const data = await parseResponse(response);

    if (!response.ok) {
      throw new ApiError(getErrorMessage(data, `La API respondió con estado ${response.status}.`), {
        data,
        kind: 'http',
        status: response.status,
      });
    }

    return data as TResponse;
  } catch (error) {
    if (isApiError(error)) {
      throw error;
    }

    if (controller.signal.aborted) {
      throw new ApiError(
        timedOut ? 'La solicitud excedió el tiempo de espera.' : 'La solicitud fue cancelada.',
        {
          cause: error,
          kind: timedOut ? 'timeout' : 'abort',
        },
      );
    }

    throw new ApiError('No fue posible conectar con la API.', {
      cause: error,
      kind: 'network',
    });
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromExternalSignal);
  }
}

export const httpClient: HttpClient = { request };
