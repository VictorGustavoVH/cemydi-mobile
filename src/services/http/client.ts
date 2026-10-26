import { env } from '@/config/env';

import { ApiError, isApiError } from './api-error';
import type { HttpClient, HttpRequestOptions } from './types';

export const DEFAULT_HTTP_TIMEOUT_MS = 15_000;

const RELATIVE_PATH_ERROR = 'Las solicitudes deben usar rutas relativas a la API configurada.';

function createRequestUrl(path: string): string {
  const baseUrl = new URL(`${env.apiUrl}/`);
  let requestUrl: URL;

  try {
    requestUrl = new URL(path.replace(/^\/+/, ''), baseUrl);
  } catch {
    throw new ApiError(RELATIVE_PATH_ERROR, { kind: 'parse' });
  }

  if (requestUrl.origin !== baseUrl.origin || !requestUrl.pathname.startsWith(baseUrl.pathname)) {
    throw new ApiError(RELATIVE_PATH_ERROR, { kind: 'parse' });
  }

  return requestUrl.toString();
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

async function requestOnce<TResponse = unknown>(
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
      throw new ApiError(
        getErrorMessage(data, `El servidor respondió con estado ${response.status}.`),
        {
          kind: 'http',
          status: response.status,
        },
      );
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

    throw new ApiError('No fue posible conectar con el servidor.', {
      cause: error,
      kind: 'network',
    });
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromExternalSignal);
  }
}

type HttpAuth = {
  getAccessToken: () => string | null;
  getVersion: () => number;
  refresh: () => Promise<void>;
  expired: () => Promise<void>;
};
let auth: HttpAuth | null = null;
export function configureHttpAuth(value: HttpAuth) {
  auth = value;
}

async function request<TResponse = unknown>(
  path: string,
  options: HttpRequestOptions = {},
): Promise<TResponse> {
  const { authenticated, ...requestOptions } = options;
  if (!authenticated) return requestOnce<TResponse>(path, requestOptions);
  const session = auth;
  if (!session) throw new ApiError('Sesión no disponible.', { kind: 'http', status: 401 });
  const version = session.getVersion();
  let token = session.getAccessToken();
  if (!token) {
    await session.refresh();
    token = session.getAccessToken();
  }
  const send = () => {
    if (version !== session.getVersion())
      throw new ApiError('La sesión cambió.', { kind: 'abort' });
    const currentToken = session.getAccessToken();
    if (!currentToken) throw new ApiError('Sesión expirada.', { kind: 'http', status: 401 });
    const headers = new Headers(requestOptions.headers);
    headers.set('Authorization', `Bearer ${currentToken}`);
    return requestOnce<TResponse>(path, { ...requestOptions, headers, credentials: 'omit' });
  };
  try {
    const result = await send();
    if (version !== session.getVersion())
      throw new ApiError('La sesión cambió.', { kind: 'abort' });
    return result;
  } catch (error) {
    if (!isApiError(error) || error.status !== 401 || requestOptions.signal?.aborted) throw error;
    if (version !== session.getVersion())
      throw new ApiError('La sesión cambió.', { kind: 'abort' });
    if (token === session.getAccessToken()) await session.refresh();
    const retryToken = session.getAccessToken();
    try {
      const result = await send();
      if (version !== session.getVersion())
        throw new ApiError('La sesión cambió.', { kind: 'abort' });
      return result;
    } catch (retryError) {
      if (
        isApiError(retryError) &&
        retryError.status === 401 &&
        retryToken === session.getAccessToken()
      )
        await session.expired();
      throw retryError;
    }
  }
}

export const httpClient: HttpClient = { request };
