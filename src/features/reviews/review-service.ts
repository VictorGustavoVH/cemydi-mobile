import { reviewStatusSchema } from '@/services/reviews/review-status';
import { z } from 'zod';
import { httpClient } from '@/services/http/client';
import { ApiError, isApiError, UserFacingError } from '@/services/http/api-error';

export const reviewFormSchema = z.object({
  rating: z.number().int().min(1, 'Selecciona una calificación.').max(5),
  comment: z
    .string()
    .trim()
    .min(5, 'Escribe al menos 5 caracteres.')
    .max(500, 'Escribe hasta 500 caracteres.')
    // Early feedback only; the server owns normalization and moderation.
    .refine(
      (value) =>
        value.length > 500 ||
        !/<\s*\/?\s*[a-z][^>]*>|<\s*(?:script|iframe|svg|object|embed)\b|<\?|<%|\b(?:javascript|vbscript)\s*:/i.test(
          value,
        ),
      'Escribe tu opinión solo con texto.',
    ),
});
export type ReviewFormValues = z.infer<typeof reviewFormSchema>;
const ownReviewSchema = z.object({
  id: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  comment: z.string(),
  status: reviewStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
const mineSchema = z.object({ review: ownReviewSchema.nullable() });
const submittedSchema = z.object({ message: z.string(), review: ownReviewSchema });
export const ownReviewKey = (userId: number | undefined, productId: string) =>
  ['account', userId, 'review', productId] as const;
export function isReviewProductId(value: string) {
  return /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));
}
function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new ApiError('Respuesta de reseñas inválida.', { kind: 'parse' });
  return parsed.data;
}
const contentMessages = new Map([
  ['Escribe una opinión de 5 a 500 caracteres.', 'Escribe una opinión de 5 a 500 caracteres.'],
  [
    'Escribe tu opinión como texto, sin HTML, scripts ni código.',
    'Escribe tu opinión solo con texto.',
  ],
  [
    'Tu reseña contiene lenguaje ofensivo. Reformúlala sin groserías.',
    'Tu reseña contiene lenguaje ofensivo. Reformúlala sin groserías.',
  ],
]);
export const reviewService = {
  async mine(productId: string, signal?: AbortSignal) {
    if (!isReviewProductId(productId)) throw new ApiError('Producto no válido.', { kind: 'parse' });
    return parse(
      mineSchema,
      await httpClient.request(`/reviews/product/${productId}/mine`, {
        authenticated: true,
        signal,
        cache: 'no-store',
      }),
    );
  },
  async submit(productId: string, values: ReviewFormValues) {
    if (!isReviewProductId(productId)) throw new ApiError('Producto no válido.', { kind: 'parse' });
    const form = reviewFormSchema.parse(values);
    try {
      return parse(
        submittedSchema,
        await httpClient.request('/reviews', {
          method: 'POST',
          authenticated: true,
          json: { productId: Number(productId), ...form },
        }),
      );
    } catch (error) {
      if (isApiError(error) && error.kind === 'http' && error.status === 400) {
        throw new UserFacingError(
          contentMessages.get(error.message) ??
            'No pudimos guardar la reseña. Revisa la calificación y tu comentario.',
        );
      }
      throw error;
    }
  },
};
