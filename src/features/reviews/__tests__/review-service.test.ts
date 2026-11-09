import { configureHttpAuth } from '@/services/http/client';
import { jsonResponse } from '../../../../tests/support/auth-api-mock';
import { reviewService, reviewFormSchema } from '../review-service';
const review = {
  id: 7,
  rating: 4,
  comment: 'Buena atención',
  status: 'PENDING',
  createdAt: '2026-10-31T12:00:00.000Z',
  updatedAt: '2026-10-31T12:00:00.000Z',
};
beforeEach(() =>
  configureHttpAuth({
    getAccessToken: () => 'fixture',
    getVersion: () => 1,
    refresh: async () => undefined,
    expired: async () => undefined,
  }),
);
it('lee la reseña propia y envía solo el DTO confirmado con Bearer', async () => {
  jest
    .mocked(fetch)
    .mockResolvedValueOnce(jsonResponse({ review: null }))
    .mockResolvedValueOnce(jsonResponse({ message: 'Pendiente', review }));
  await expect(reviewService.mine('101')).resolves.toEqual({ review: null });
  await expect(
    reviewService.submit('101', { rating: 4, comment: '  Buena atención  ' }),
  ).resolves.toMatchObject({ review });
  const [url, options] = jest.mocked(fetch).mock.calls[1];
  expect(url).toBe('https://cemydi.test.invalid/reviews');
  expect(options?.method).toBe('POST');
  expect(options?.credentials).toBe('omit');
  expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer fixture');
  expect(JSON.parse(String(options?.body))).toEqual({
    productId: 101,
    rating: 4,
    comment: 'Buena atención',
  });
});
it('no envía ids, ratings, comentarios vacíos ni respuestas inválidas', async () => {
  await expect(
    reviewService.submit('../1', { rating: 4, comment: 'Buena atención' }),
  ).rejects.toBeDefined();
  expect(reviewFormSchema.safeParse({ rating: 0, comment: '     ' }).success).toBe(false);
  expect(reviewFormSchema.safeParse({ rating: 6, comment: 'a'.repeat(501) }).success).toBe(false);
  expect(fetch).not.toHaveBeenCalled();
  jest
    .mocked(fetch)
    .mockResolvedValueOnce(jsonResponse({ message: 'Guardada', review: { ...review, rating: 9 } }));
  await expect(
    reviewService.submit('101', { rating: 4, comment: 'Buen producto' }),
  ).rejects.toMatchObject({ kind: 'parse' });
});
it('propaga el motivo de moderación sin convertirlo en éxito', async () => {
  jest
    .mocked(fetch)
    .mockResolvedValueOnce(
      jsonResponse(
        { message: 'Tu reseña contiene lenguaje ofensivo. Reformúlala sin groserías.' },
        400,
      ),
    );
  await expect(
    reviewService.submit('101', { rating: 4, comment: 'Texto de prueba' }),
  ).rejects.toMatchObject({
    message: 'Tu reseña contiene lenguaje ofensivo. Reformúlala sin groserías.',
  });
});

it('traduce la validación técnica del servidor a una indicación para el cliente', async () => {
  jest
    .mocked(fetch)
    .mockResolvedValueOnce(
      jsonResponse({ message: 'Escribe tu opinión como texto, sin HTML, scripts ni código.' }, 400),
    );
  await expect(
    reviewService.submit('101', { rating: 4, comment: 'Texto pendiente de validación remota' }),
  ).rejects.toMatchObject({ message: 'Escribe tu opinión solo con texto.' });
});

it.each([
  '<script>alert(1)</script>',
  '<iframe src="x"></iframe>',
  '<img src="x" onerror="alert(1)">',
  '<b>Buen producto</b>',
  '<script',
  'javascript:alert(1)',
])('rechaza contenido evidente antes de enviar HTTP: %s', async (comment) => {
  expect(reviewFormSchema.safeParse({ rating: 4, comment }).success).toBe(false);
  await expect(reviewService.submit('101', { rating: 4, comment })).rejects.toBeDefined();
  expect(fetch).not.toHaveBeenCalled();
});

it.each(['Me gustó, aunque no es perfecto.', 'La altura es < 2 metros y > 1 metro.'])(
  'conserva puntuación y opiniones normales: %s',
  (comment) => {
    expect(reviewFormSchema.parse({ rating: 3, comment: `  ${comment}  ` }).comment).toBe(comment);
  },
);
