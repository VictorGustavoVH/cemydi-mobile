import { z } from 'zod';

export const OTP_LENGTH = 8;
export const RESEND_COOLDOWN_SECONDS = 60;

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Ingresa tu correo electrónico')
  .max(254, 'Máximo 254 caracteres')
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'El formato del correo no es válido');

export function getPasswordRules(password: string) {
  return [
    { label: 'Entre 10 y 72 caracteres', met: password.length >= 10 && password.length <= 72 },
    { label: 'Una letra mayúscula', met: /[A-Z]/.test(password) },
    { label: 'Un número', met: /\d/.test(password) },
    { label: 'Un símbolo', met: /[\W_]/.test(password) },
  ];
}

export const passwordSchema = z
  .string()
  .min(1, 'Ingresa una contraseña')
  .min(10, 'Mínimo 10 caracteres')
  .max(72, 'Máximo 72 caracteres')
  .regex(/[A-Z]/, 'Incluye al menos una letra mayúscula')
  .regex(/\d/, 'Incluye al menos un número')
  .regex(/[\W_]/, 'Incluye al menos un símbolo');

const passwordFields = {
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
};

export const loginSchema = z.object({
  correo: emailSchema,
  password: z
    .string()
    .min(1, 'Ingresa tu contraseña')
    .min(8, 'Mínimo 8 caracteres')
    .max(72, 'Máximo 72 caracteres'),
});

export const registerSchema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(1, 'Ingresa tu nombre completo')
      .min(3, 'El nombre debe tener al menos 3 caracteres')
      .max(100, 'Máximo 100 caracteres')
      .regex(
        /^[\p{L}\p{M}]+(?:[ '\-][\p{L}\p{M}]+)*$/u,
        'Revisa que tu nombre no contenga números ni símbolos especiales',
      ),
    correo: emailSchema,
    ...passwordFields,
    acceptedTerms: z
      .boolean()
      .refine(Boolean, 'Debes aceptar los términos y condiciones para continuar'),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden',
  });

export const recoverySchema = z.object({ correo: emailSchema });
export const otpSchema = z.object({
  codigo: z.string().regex(/^\d{8}$/, 'Completa los 8 dígitos del código'),
});
export const newPasswordSchema = z
  .object(passwordFields)
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden',
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type RecoveryValues = z.infer<typeof recoverySchema>;
export type OtpValues = z.infer<typeof otpSchema>;
export type NewPasswordValues = z.infer<typeof newPasswordSchema>;
