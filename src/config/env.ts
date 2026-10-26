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

/**
 * Valida el origen público de la web usado para abrir enlaces legales.
 * Es opcional: ausente devuelve `null` sin bloquear el arranque. Exige https en
 * producción y permite http en desarrollo, igual que `EXPO_PUBLIC_API_URL`.
 */
export function parseWebsiteUrl(
  value: string | undefined,
  appEnvironment: AppEnvironment,
): string | null {
  const rawWebsiteUrl = value?.trim();

  if (!rawWebsiteUrl) {
    return null;
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawWebsiteUrl);
  } catch {
    throw new Error('EXPO_PUBLIC_WEBSITE_URL debe ser una URL absoluta válida.');
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('EXPO_PUBLIC_WEBSITE_URL debe usar el protocolo http o https.');
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new Error('EXPO_PUBLIC_WEBSITE_URL no debe incluir credenciales.');
  }

  if (appEnvironment === 'production' && parsedUrl.protocol !== 'https:') {
    throw new Error('EXPO_PUBLIC_WEBSITE_URL debe usar https en production.');
  }

  return rawWebsiteUrl.replace(/\/+$/, '');
}

const appEnv = parseAppEnvironment(process.env.EXPO_PUBLIC_APP_ENV);

if (!__DEV__ && appEnv !== 'production') {
  throw new Error('Un build release requiere EXPO_PUBLIC_APP_ENV=production y una API HTTPS.');
}

export const env = Object.freeze({
  apiUrl: parseApiUrl(process.env.EXPO_PUBLIC_API_URL, appEnv),
  appEnv,
});
