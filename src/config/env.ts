export type AppEnvironment = 'development' | 'staging' | 'production';

function requireEnvironmentVariable(name: string, value: string | undefined): string {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    throw new Error(`Falta la variable de entorno requerida ${name}.`);
  }

  return normalizedValue;
}

function parseAppEnvironment(value: string | undefined): AppEnvironment {
  const appEnvironment = requireEnvironmentVariable('EXPO_PUBLIC_APP_ENV', value);

  if (
    appEnvironment !== 'development' &&
    appEnvironment !== 'staging' &&
    appEnvironment !== 'production'
  ) {
    throw new Error('EXPO_PUBLIC_APP_ENV debe ser development, staging o production.');
  }

  return appEnvironment;
}

function parseApiUrl(value: string | undefined, appEnvironment: AppEnvironment): string {
  const rawApiUrl = requireEnvironmentVariable('EXPO_PUBLIC_API_URL', value);
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawApiUrl);
  } catch {
    throw new Error('EXPO_PUBLIC_API_URL debe ser una URL absoluta válida.');
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('EXPO_PUBLIC_API_URL debe usar el protocolo http o https.');
  }

  if (appEnvironment === 'production' && parsedUrl.protocol !== 'https:') {
    throw new Error('EXPO_PUBLIC_API_URL debe usar https en production.');
  }

  return rawApiUrl.replace(/\/+$/, '');
}

const appEnv = parseAppEnvironment(process.env.EXPO_PUBLIC_APP_ENV);

export const env = Object.freeze({
  apiUrl: parseApiUrl(process.env.EXPO_PUBLIC_API_URL, appEnv),
  appEnv,
});
