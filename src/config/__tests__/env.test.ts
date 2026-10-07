const testEnvironment = { ...process.env };

function readEnvironment() {
  let result: typeof import('../env').env | undefined;
  jest.isolateModules(() => {
    result = jest.requireActual<typeof import('../env')>('../env').env;
  });
  return result;
}

afterEach(() => {
  process.env = { ...testEnvironment };
});

describe('Configuración pública de entorno', () => {
  it('normaliza la URL y expone configuración inmutable', () => {
    process.env.EXPO_PUBLIC_API_URL = ' https://cemydi.test.invalid/// ';
    expect(readEnvironment()).toEqual({
      apiUrl: 'https://cemydi.test.invalid',
      appEnv: 'development',
    });
    expect(Object.isFrozen(readEnvironment())).toBe(true);
  });

  it.each(['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_APP_ENV'])('exige %s', (variable) => {
    delete process.env[variable];
    expect(readEnvironment).toThrow(`Falta la variable de entorno requerida ${variable}`);
  });

  it.each(['test', '', 'prod'])('rechaza el entorno %s', (value) => {
    process.env.EXPO_PUBLIC_APP_ENV = value;
    expect(readEnvironment).toThrow();
  });

  it.each(['not-a-url', 'ftp://cemydi.test.invalid'])('rechaza la URL %s', (value) => {
    process.env.EXPO_PUBLIC_API_URL = value;
    expect(readEnvironment).toThrow(/EXPO_PUBLIC_API_URL/);
  });

  it('exige HTTPS en producción y permite HTTP en desarrollo', () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://cemydi.test.invalid';
    expect(readEnvironment()?.appEnv).toBe('development');
    process.env.EXPO_PUBLIC_APP_ENV = 'production';
    expect(readEnvironment).toThrow('EXPO_PUBLIC_API_URL debe usar https en production.');
    process.env.EXPO_PUBLIC_API_URL = 'https://cemydi.test.invalid';
    expect(readEnvironment()?.appEnv).toBe('production');
  });
});
