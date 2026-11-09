import { z } from 'zod';
import { httpClient } from '@/services/http/client';
import { ApiError, isApiError, UserFacingError } from '@/services/http/api-error';
import { rentalSchema } from './rental-schemas';

const optionalText = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres.`);
export const rentalRequirementsSchema = z
  .object({
    applicantName: z.string().trim().min(2, 'Escribe el nombre completo.').max(160),
    applicantEmail: z.email('Escribe un correo válido.').max(190),
    applicantPhone: z
      .string()
      .trim()
      .regex(/^\d{10}$/, 'Escribe un teléfono de 10 dígitos.'),
    isForAnotherPerson: z.boolean(),
    patientName: optionalText(160),
    patientRelationship: optionalText(120),
    patientRelationshipOther: optionalText(120),
    deliveryMethod: z.enum(['PICKUP', 'HOME_DELIVERY']),
    deliveryAddress: optionalText(240),
    deliveryNeighborhood: optionalText(120),
    deliveryPostalCode: optionalText(5),
    deliveryMunicipality: optionalText(120),
    deliveryReferences: optionalText(300),
    preferredSchedule: z
      .string()
      .regex(/^$|^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Selecciona una hora válida.'),
    generalNotes: optionalText(1000),
    acceptRentalTerms: z.boolean(),
    acceptPrivacy: z.boolean(),
  })
  .superRefine((value, ctx) => {
    const require = (field: keyof typeof value, min: number, message: string) => {
      if (String(value[field]).length < min)
        ctx.addIssue({ code: 'custom', path: [field], message });
    };
    if (value.isForAnotherPerson) {
      require('patientName', 2, 'Escribe el nombre del paciente.');
      require('patientRelationship', 2, 'Indica tu relación con el paciente.');
      if (value.patientRelationship === 'Otro')
        require('patientRelationshipOther', 2, 'Especifica la relación con el paciente.');
    }
    if (value.deliveryMethod === 'HOME_DELIVERY') {
      require('deliveryAddress', 5, 'Escribe la calle y número de entrega.');
      require('deliveryNeighborhood', 2, 'Escribe la colonia.');
      require('deliveryMunicipality', 2, 'Escribe el municipio.');
      if (!/^\d{5}$/.test(value.deliveryPostalCode))
        ctx.addIssue({
          code: 'custom',
          path: ['deliveryPostalCode'],
          message: 'Escribe los 5 dígitos del código postal.',
        });
    }
  });
export const rentalRequestSchema = rentalRequirementsSchema.superRefine((value, ctx) => {
  for (const field of ['acceptRentalTerms', 'acceptPrivacy'] as const) {
    if (!value[field])
      ctx.addIssue({
        code: 'custom',
        path: [field],
        message: 'Acepta esta condición para enviar la solicitud.',
      });
  }
});
export type RentalRequestInput = z.infer<typeof rentalRequestSchema>;

export const prescriptionDocumentSchema = z.object({
  id: z.uuid(),
  originalFilename: z.string(),
  mimeType: z.string(),
  bytes: z.number().int().nonnegative(),
  status: z.enum(['PENDIENTE', 'EN_REVISION', 'APROBADO', 'RECHAZADO']),
  uploadedAt: z.iso.datetime(),
  associatedAt: z.iso.datetime().nullable(),
});
const messageSchema = z.object({ message: z.string() });
const prescriptionResponseSchema = messageSchema.extend({ document: prescriptionDocumentSchema });
const createdSchema = messageSchema.extend({ rental: rentalSchema });

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  options: Parameters<typeof httpClient.request>[1],
) {
  try {
    const data = await httpClient.request(path, { ...options, authenticated: true });
    const result = schema.safeParse(data);
    if (!result.success) throw new ApiError('Respuesta de renta inválida.', { kind: 'parse' });
    return result.data;
  } catch (error) {
    if (isApiError(error) && [400, 403, 404, 409, 413, 415, 429].includes(error.status ?? 0)) {
      throw new UserFacingError(
        error.status === 413
          ? 'La receta supera el máximo de 8 MB.'
          : error.status === 429
            ? 'Demasiados intentos. Espera antes de volver a intentarlo.'
            : 'No pudimos completar la operación. Revisa fechas, disponibilidad, documentos y datos de la solicitud.',
      );
    }
    throw error;
  }
}
export const rentalRequestService = {
  create: (input: RentalRequestInput) =>
    request('/rentals/from-cart', createdSchema, {
      method: 'POST',
      json: rentalRequestSchema.parse(input),
    }),
  upload: (itemId: number, body: FormData) =>
    request(
      `/rentals/cart-items/${z.number().int().positive().parse(itemId)}/prescription`,
      prescriptionResponseSchema,
      { method: 'POST', body, timeoutMs: 60_000 },
    ),
  remove: (itemId: number) =>
    request(
      `/rentals/cart-items/${z.number().int().positive().parse(itemId)}/prescription`,
      messageSchema,
      { method: 'DELETE' },
    ),
};
