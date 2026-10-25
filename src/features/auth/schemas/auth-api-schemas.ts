import { z } from 'zod';

export const authUserSchema = z.object({
  id: z.number().int().positive(),
  nombre: z.string(),
  correo: z.email(),
  activo: z.boolean(),
  rol: z.enum(['ADMIN', 'CLIENT']),
  emailVerified: z.boolean(),
  emailVerifiedAt: z.iso.datetime().nullable(),
});

export const mobileSessionSchema = z.object({
  user: authUserSchema,
  accessToken: z.string().min(1),
  refreshToken: z.string().regex(/^[a-f0-9]{64}$/),
  accessExpiresInMs: z.number().nonnegative(),
  refreshExpiresInMs: z.number().nonnegative(),
});
export type MobileSession = z.infer<typeof mobileSessionSchema>;
export const authMessageSchema = z.object({ message: z.string().min(1) });
export const verifiedCodeSchema = authMessageSchema.extend({ expiresAt: z.iso.datetime() });
export const currentUserSchema = z.object({ user: authUserSchema.nullable() });
export type AuthUser = z.infer<typeof authUserSchema>;
