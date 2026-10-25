export type HttpMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';

type RequestPayload =
  | {
      body?: BodyInit;
      json?: never;
    }
  | {
      body?: never;
      json: unknown;
    };

type BaseRequestOptions = Omit<RequestInit, 'body' | 'method' | 'signal'> & {
  authenticated?: boolean;
  method?: HttpMethod;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type HttpRequestOptions = BaseRequestOptions & RequestPayload;

export interface HttpClient {
  request<TResponse = unknown>(path: string, options?: HttpRequestOptions): Promise<TResponse>;
}
