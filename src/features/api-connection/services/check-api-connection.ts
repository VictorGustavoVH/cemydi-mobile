import { z } from 'zod';

import { ApiError } from '@/services/http/api-error';
import { httpClient } from '@/services/http/client';

const apiConnectionResponseSchema = z.literal('Hello World!');

export type ApiConnectionResponse = z.infer<typeof apiConnectionResponseSchema>;

export async function checkApiConnection(): Promise<ApiConnectionResponse> {
  const response = await httpClient.request<unknown>('/');
  const parsedResponse = apiConnectionResponseSchema.safeParse(response);

  if (!parsedResponse.success) {
    throw new ApiError('La API devolvió una respuesta de conexión inesperada.', {
      data: response,
      kind: 'parse',
    });
  }

  return parsedResponse.data;
}
