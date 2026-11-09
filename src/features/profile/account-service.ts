import { reviewStatusSchema } from '@/services/reviews/review-status';
import { z } from 'zod';
import { httpClient } from '@/services/http/client';
import { ApiError, isApiError, UserFacingError } from '@/services/http/api-error';

import { rentalSchema, rentalsResponseSchema } from '@/services/rentals/rental-schemas';
export {
  rentalSchema,
  rentalLabels,
  rentalStatus,
  rentalsResponseSchema,
} from '@/services/rentals/rental-schemas';
export type { Rental } from '@/services/rentals/rental-schemas';
export const reviewsResponseSchema = z.object({
  reviews: z.array(
    z.object({
      id: z.number().int(),
      rating: z.number().int().min(1).max(5),
      comment: z.string(),
      status: reviewStatusSchema,
      updatedAt: z.iso.datetime(),
      product: z.object({
        id: z.number().int(),
        slug: z.string().nullable(),
        nombre: z.string(),
        imageUrl: z.string().nullable(),
      }),
    }),
  ),
});
export const legalSlugs = ['politicas-de-privacidad', 'terminos-y-condiciones'] as const;
export const legalResponseSchema = z.object({
  document: z.object({
    slug: z.enum(legalSlugs),
    title: z.string(),
    description: z.string(),
    sections: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        body: z.string(),
        variant: z.literal('medical-alert').optional(),
      }),
    ),
  }),
});
async function read<T>(
  path: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
  authenticated = true,
): Promise<T> {
  const data = await httpClient.request(path, { authenticated, cache: 'no-store', signal });
  const result = schema.safeParse(data);
  if (!result.success) throw new ApiError('Respuesta de cuenta inválida.', { kind: 'parse' });
  return result.data;
}
export const accountService = {
  rentals: (page: number, signal?: AbortSignal) =>
    read(`/rentals/mine?page=${page}&pageSize=8`, rentalsResponseSchema, signal),
  rental: (id: string, signal?: AbortSignal) =>
    read(
      `/rentals/mine/${encodeURIComponent(id)}`,
      z.object({ rental: rentalSchema }).refine((data) => data.rental.id === id),
      signal,
    ),
  reviews: (signal?: AbortSignal) => read('/reviews/mine', reviewsResponseSchema, signal),
  legal: (slug: (typeof legalSlugs)[number], signal?: AbortSignal) =>
    read(
      `/legal-documents/${slug}`,
      legalResponseSchema.refine((data) => data.document.slug === slug),
      signal,
      false,
    ),
  async cancelRental(id: string) {
    try {
      const data = await httpClient.request(`/rentals/${encodeURIComponent(id)}/cancel`, {
        authenticated: true,
        method: 'PATCH',
      });
      const parsed = z.object({ message: z.string(), rental: rentalSchema }).safeParse(data);
      if (!parsed.success || parsed.data.rental.id !== id)
        throw new ApiError('Respuesta de renta inválida.', { kind: 'parse' });
      return parsed.data;
    } catch (error) {
      if (isApiError(error) && error.kind === 'http' && [400, 403, 409].includes(error.status ?? 0))
        throw new UserFacingError(
          error.message === 'Solo puedes cancelar solicitudes pendientes'
            ? error.message
            : 'No pudimos cancelar la renta. Revisa su estado e intenta de nuevo.',
        );
      throw error;
    }
  },
};

// Plain native reading view. Never executes HTML or loads remote scripts/media.
export function legalText(html: string) {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(
      /<a\b[^>]*href=["']((?:https?:\/\/|mailto:)[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
      '$2 ($1)',
    )
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(?:p|div|h[1-6]|li|tr)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(x[\da-f]+|\d+);/gi, (raw, value: string) => {
      const code = value[0].toLowerCase() === 'x' ? parseInt(value.slice(1), 16) : Number(value);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code)
        : raw;
    })
    .replace(
      /&(nbsp|amp|lt|gt|quot|apos);/g,
      (_, entity: string) =>
        ({ nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[entity] ?? '',
    )
    .replace(/\n[\t ]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
