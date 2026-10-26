import { httpClient, DEFAULT_HTTP_TIMEOUT_MS } from '@/services/http/client';

describe('Cliente HTTP, entorno y normalización de respuestas', () => {
  it('bloquea cualquier fetch que no tenga una respuesta explícita de test', async () => {
    await expect(httpClient.request('/')).rejects.toMatchObject({ kind: 'network' });
    expect(fetch).toHaveBeenCalledWith('https://cemydi.test.invalid/', expect.any(Object));
  });

  it('usa URL relativa, método, headers y JSON; interpreta la respuesta', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(
      new Response('{"message":"fixture"}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    // Exercise transport options only; this does not define a backend POST contract.
    await expect(
      httpClient.request('/', {
        method: 'POST',
        json: { message: 'fixture' },
        headers: { 'X-Test': 'transport' },
      }),
    ).resolves.toEqual({ message: 'fixture' });
    const [url, options] = jest.mocked(fetch).mock.calls[0];
    expect(url).toBe('https://cemydi.test.invalid/');
    expect(options).toMatchObject({ method: 'POST', body: '{"message":"fixture"}' });
    const headers = new Headers(options?.headers);
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('X-Test')).toBe('transport');
  });

  it('conserva texto y respuestas vacías', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(new Response('Hello World!', { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(httpClient.request('/')).resolves.toBe('Hello World!');
    await expect(httpClient.request('/')).resolves.toBeUndefined();
  });

  it('envía multipart sin fijar el boundary ni Content-Type', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));
    const body = new FormData();
    body.append('fixture', 'test');
    await httpClient.request('/', { method: 'POST', body });
    const options = jest.mocked(fetch).mock.calls[0][1];
    expect(options?.body).toBe(body);
    expect(new Headers(options?.headers).has('Content-Type')).toBe(false);
  });

  it.each([400, 401, 403, 404, 409, 429, 500, 503])('normaliza errores HTTP %i', async (status) => {
    jest.mocked(fetch).mockResolvedValueOnce(
      new Response('{"message":["Error A","Error B"]}', {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await expect(httpClient.request('/')).rejects.toMatchObject({
      kind: 'http',
      status,
      message: 'Error A, Error B',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rechaza JSON inválido exitoso y preserva el estado de un error con body inválido', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(
        new Response('{', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('{', {
          status: 502,
          headers: { 'content-type': 'application/json' },
        }),
      );
    await expect(httpClient.request('/')).rejects.toMatchObject({ kind: 'parse', status: 200 });
    await expect(httpClient.request('/')).rejects.toMatchObject({ kind: 'http', status: 502 });
  });

  it('rechaza URLs externas antes de llamar a fetch', async () => {
    await expect(httpClient.request('https://external.test.invalid')).rejects.toMatchObject({
      kind: 'parse',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('distingue timeout de cancelación y retira el listener externo', async () => {
    jest.useFakeTimers();
    try {
      jest.mocked(fetch).mockImplementation(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            if (options?.signal?.aborted) reject(new Error('Aborted'));
            else
              options?.signal?.addEventListener('abort', () => reject(new Error('Aborted')), {
                once: true,
              });
          }),
      );
      const timedOut = expect(httpClient.request('/')).rejects.toMatchObject({ kind: 'timeout' });
      await jest.advanceTimersByTimeAsync(DEFAULT_HTTP_TIMEOUT_MS);
      await timedOut;
      const controller = new AbortController();
      const remove = jest.spyOn(controller.signal, 'removeEventListener');
      const cancelled = expect(
        httpClient.request('/', { signal: controller.signal }),
      ).rejects.toMatchObject({ kind: 'abort' });
      controller.abort();
      await cancelled;
      expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
