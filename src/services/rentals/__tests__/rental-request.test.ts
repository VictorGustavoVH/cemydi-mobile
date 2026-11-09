import { configureHttpAuth } from '@/services/http/client';
import { jsonResponse } from '../../../../tests/support/auth-api-mock';
import { RENTAL } from '../../../../tests/support/account-api-mock';
import {
  rentalRequestSchema,
  rentalRequirementsSchema,
  rentalRequestService,
  type RentalRequestInput,
} from '../rental-request';

export const requestInput: RentalRequestInput = {
  applicantName: 'Cliente de prueba',
  applicantEmail: 'cliente@example.invalid',
  applicantPhone: '5551234567',
  isForAnotherPerson: false,
  patientName: '',
  patientRelationship: '',
  patientRelationshipOther: '',
  deliveryMethod: 'PICKUP',
  deliveryAddress: '',
  deliveryNeighborhood: '',
  deliveryPostalCode: '',
  deliveryMunicipality: '',
  deliveryReferences: '',
  preferredSchedule: '',
  generalNotes: '',
  acceptRentalTerms: true,
  acceptPrivacy: true,
};
describe('Solicitud de renta', () => {
  it('exige diez dígitos y una hora válida sin aceptar texto libre', () => {
    for (const applicantPhone of ['123456789', '12345678901', '555 123 4567', 'abcdefghij']) {
      expect(rentalRequirementsSchema.safeParse({ ...requestInput, applicantPhone }).success).toBe(
        false,
      );
    }
    for (const preferredSchedule of ['25:00', '12:60', 'por la tarde']) {
      expect(
        rentalRequirementsSchema.safeParse({ ...requestInput, preferredSchedule }).success,
      ).toBe(false);
    }
    expect(
      rentalRequirementsSchema.safeParse({ ...requestInput, preferredSchedule: '13:05' }).success,
    ).toBe(true);
  });
  beforeEach(() =>
    configureHttpAuth({
      getAccessToken: () => 'fixture',
      getVersion: () => 1,
      refresh: async () => undefined,
      expired: async () => undefined,
    }),
  );
  it('valida requisitos condicionales y exige aceptaciones solo al enviar', () => {
    expect(
      rentalRequirementsSchema.safeParse({ ...requestInput, acceptPrivacy: false }).success,
    ).toBe(true);
    expect(rentalRequestSchema.safeParse({ ...requestInput, acceptPrivacy: false }).success).toBe(
      false,
    );
    expect(
      rentalRequestSchema.safeParse({ ...requestInput, isForAnotherPerson: true }).success,
    ).toBe(false);
    expect(
      rentalRequestSchema.safeParse({
        ...requestInput,
        isForAnotherPerson: true,
        patientName: 'Paciente',
        patientRelationship: 'Otro',
      }).success,
    ).toBe(false);
    expect(
      rentalRequestSchema.safeParse({ ...requestInput, deliveryMethod: 'HOME_DELIVERY' }).success,
    ).toBe(false);
    expect(
      rentalRequestSchema.safeParse({
        ...requestInput,
        deliveryMethod: 'HOME_DELIVERY',
        deliveryAddress: 'Calle de prueba 123',
        deliveryNeighborhood: 'Centro',
        deliveryMunicipality: 'Municipio',
        deliveryPostalCode: '12345',
      }).success,
    ).toBe(true);
  });
  it('envía el DTO con Bearer y valida la confirmación', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: 'Recibida', rental: RENTAL }));
    expect((await rentalRequestService.create(requestInput)).rental.id).toBe(RENTAL.id);
    const [url, options] = jest.mocked(fetch).mock.calls[0];
    expect(url).toBe('https://cemydi.test.invalid/rentals/from-cart');
    expect(options).toMatchObject({
      method: 'POST',
      credentials: 'omit',
      body: JSON.stringify(requestInput),
    });
    expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer fixture');
  });
  it('no reintenta ni inventa éxito con respuesta inválida o pérdida de conexión', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: 'Recibida', rental: {} }));
    await expect(rentalRequestService.create(requestInput)).rejects.toMatchObject({
      kind: 'parse',
    });
    jest.mocked(fetch).mockRejectedValueOnce(new TypeError('network'));
    await expect(rentalRequestService.create(requestInput)).rejects.toMatchObject({
      kind: 'network',
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('envía multipart sin fijar Content-Type y oculta mensajes técnicos del servidor', async () => {
    const body = new FormData();
    jest.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        message: 'Adjunta',
        document: {
          id: 'c343af9c-f65a-4eb9-83df-ef77e3b53548',
          originalFilename: 'receta.pdf',
          mimeType: 'application/pdf',
          bytes: 100,
          status: 'PENDIENTE',
          uploadedAt: RENTAL.createdAt,
          associatedAt: null,
        },
      }),
    );
    await rentalRequestService.upload(8, body);
    const [url, options] = jest.mocked(fetch).mock.calls[0];
    expect(url).toContain('/rentals/cart-items/8/prescription');
    expect(options?.body).toBe(body);
    expect(new Headers(options?.headers).has('Content-Type')).toBe(false);
    jest.mocked(fetch).mockResolvedValueOnce(jsonResponse({ message: 'SQL secret' }, 400));
    await expect(rentalRequestService.remove(8)).rejects.toThrow('Revisa fechas');
  });
});
