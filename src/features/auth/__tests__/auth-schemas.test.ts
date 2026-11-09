import { registerSchema } from '../schemas/auth-schemas';

const account = {
  correo: 'ana@cemydi.test',
  password: 'Password12!',
  confirmPassword: 'Password12!',
  acceptedTerms: true,
};

describe('validación del registro', () => {
  it.each(['Ana M.', 'José (Pepe)', 'María-José O’Connor', '李小龙'])(
    'acepta el nombre %s, que el backend admite',
    (nombre) => {
      expect(registerSchema.safeParse({ ...account, nombre }).success).toBe(true);
    },
  );

  it('mantiene el límite de 3 a 100 caracteres del backend', () => {
    expect(registerSchema.safeParse({ ...account, nombre: 'Al' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...account, nombre: 'a'.repeat(101) }).success).toBe(false);
  });
});
