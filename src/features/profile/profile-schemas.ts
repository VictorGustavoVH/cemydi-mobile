import { z } from 'zod';
import { authUserSchema } from '@/features/auth/schemas/auth-api-schemas';

export const profileUserSchema = authUserSchema.extend({
  telefono: z.string().nullable(),
  direccion: z.string().nullable(),
});
export const profileResponseSchema = z.object({ user: profileUserSchema.nullable() });
export const profileUpdateResponseSchema = z.object({
  message: z.string().min(1),
  user: profileUserSchema,
});
export type ProfileUser = z.infer<typeof profileUserSchema>;

export const profileFormSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, 'Escribe al menos 2 caracteres')
    .max(120, 'Máximo 120 caracteres')
    .refine((value) => /\p{L}/u.test(value), 'Escribe un nombre válido'),
  telefono: z
    .string()
    .trim()
    .max(30, 'Máximo 30 caracteres')
    .refine(
      (value) =>
        !value ||
        (/^\+?[\d\s().-]+$/.test(value) &&
          value.replace(/\D/g, '').length >= 7 &&
          value.replace(/\D/g, '').length <= 15),
      'Escribe un teléfono válido de 7 a 15 dígitos',
    ),
  direccion: z.string().trim().max(180, 'Máximo 180 caracteres'),
});
export type ProfileFormValues = z.input<typeof profileFormSchema>;
export type UpdateProfilePayload = Partial<z.output<typeof profileFormSchema>>;
export const toProfileForm = (user: ProfileUser): ProfileFormValues => ({
  nombre: user.nombre,
  telefono: user.telefono ?? '',
  direccion: user.direccion ?? '',
});
export function profileChanges(
  values: z.output<typeof profileFormSchema>,
  user: ProfileUser,
): UpdateProfilePayload {
  const current = toProfileForm(user);
  return Object.fromEntries(
    Object.entries(values).filter(
      ([key, value]) => value !== current[key as keyof ProfileFormValues],
    ),
  );
}
