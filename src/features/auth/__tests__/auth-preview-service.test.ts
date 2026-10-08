import { createAuthPreviewService, DEFAULT_ACCOUNT } from '../services/auth-preview-service';
import {
  emailSchema,
  getPasswordRules,
  newPasswordSchema,
  registerSchema,
} from '../schemas/auth-schemas';

describe('Contratos locales de autenticación', () => {
  it('valida límites, nombres Unicode, correo y confirmación de la web', () => {
    const valid = {
      nombre: 'José María',
      correo: ' jose@cemydi.test ',
      password: 'Password12!',
      confirmPassword: 'Password12!',
      acceptedTerms: true,
    };
    expect(registerSchema.safeParse(valid).success).toBe(true);
    for (const nombre of ['Ab', 'Nombre123', 'a'.repeat(101)]) {
      expect(registerSchema.safeParse({ ...valid, nombre }).success).toBe(false);
    }
    for (const password of [
      'Short1!',
      'sinmayuscula1!',
      'SinNumeros!!',
      'SinSimbolo12',
      `Aa1!${'x'.repeat(69)}`,
    ]) {
      expect(newPasswordSchema.safeParse({ password, confirmPassword: password }).success).toBe(
        false,
      );
    }
    expect(registerSchema.safeParse({ ...valid, acceptedTerms: false }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, confirmPassword: 'OtraClave1!' }).success).toBe(
      false,
    );
    expect(emailSchema.safeParse(`${'a'.repeat(250)}@x.com`).success).toBe(false);
    expect(getPasswordRules('Password12!').every((rule) => rule.met)).toBe(true);
  });

  it('acepta solo las credenciales correctas y normaliza el correo', () => {
    const service = createAuthPreviewService();
    expect(service.login(' CLIENTE@CEMYDI.TEST ', DEFAULT_ACCOUNT.password).correo).toBe(
      DEFAULT_ACCOUNT.correo,
    );
    expect(() => service.login(DEFAULT_ACCOUNT.correo, 'incorrecta')).toThrow('incorrectos');
    expect(() => service.login('nadie@cemydi.test', DEFAULT_ACCOUNT.password)).toThrow(
      'incorrectos',
    );
  });

  it('exige verificar el registro con ocho dígitos y consume el código', () => {
    const service = createAuthPreviewService();
    const account = { nombre: 'Ana Pérez', correo: 'ana@cemydi.test', password: 'Password12!' };
    service.register(account);
    expect(() => service.login(account.correo, account.password)).toThrow('Verifica');
    expect(() => service.verify('000000')).toThrow('incorrecto');
    expect(() => service.verify('12345678')).toThrow('incorrecto');
    expect(service.verify('00000000')).toBeNull();
    expect(service.login(account.correo, account.password).nombre).toBe('Ana Pérez');
    expect(() => service.verify('00000000')).toThrow();
    expect(() => service.register(account)).toThrow();
  });

  it('bloquea el reenvío 60 segundos y respeta expiración y cancelación', () => {
    let now = 0;
    const service = createAuthPreviewService(() => now);
    service.requestRecovery(DEFAULT_ACCOUNT.correo);
    expect(() => service.resend()).toThrow('Espera');
    expect(() => service.requestRecovery(DEFAULT_ACCOUNT.correo)).toThrow('Espera');
    now = 59_999;
    expect(() => service.resend()).toThrow('Espera');
    now = 60_000;
    expect(service.resend().resendAt).toBe(120_000);
    now += 30 * 60 * 1000;
    expect(() => service.verify('00000000')).toThrow('venció');
    service.resend();
    service.cancelChallenge();
    expect(() => service.verify('00000000')).toThrow();
  });

  it('actualiza únicamente la cuenta recuperada y exige OTP antes de guardar', () => {
    const service = createAuthPreviewService();
    expect(() => service.resetPassword('NuevaClave1!')).toThrow();
    service.requestRecovery(DEFAULT_ACCOUNT.correo);
    expect(() => service.resetPassword('NuevaClave1!')).toThrow('Primero verifica');
    service.verify('00000000');
    service.resetPassword('NuevaClave1!');
    expect(() => service.login(DEFAULT_ACCOUNT.correo, DEFAULT_ACCOUNT.password)).toThrow(
      'incorrectos',
    );
    expect(service.login(DEFAULT_ACCOUNT.correo, 'NuevaClave1!').correo).toBe(
      DEFAULT_ACCOUNT.correo,
    );
    expect(() => service.resetPassword('OtraClave12!')).toThrow();
  });

  it('no crea cuentas al recuperar un correo desconocido ni comparte estado entre proveedores', () => {
    const service = createAuthPreviewService();
    service.requestRecovery('nadie@cemydi.test');
    service.verify('00000000');
    expect(() => service.resetPassword('NuevaClave1!')).toThrow('No pudimos');
    expect(() => service.login('nadie@cemydi.test', 'NuevaClave1!')).toThrow();
    expect(
      createAuthPreviewService().login(DEFAULT_ACCOUNT.correo, DEFAULT_ACCOUNT.password),
    ).toBeTruthy();
  });
});
