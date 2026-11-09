import type { DocumentPickerAsset } from 'expo-document-picker';
import { UserFacingError } from '@/services/http/api-error';
import { initializePrescriptionCache } from '@/services/prescriptions/prescription-cache';

const types = new Map([
  ['pdf', 'application/pdf'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['webp', 'image/webp'],
]);
export function prescriptionFormData(
  asset: DocumentPickerAsset,
  readBytes?: () => Promise<Uint8Array>,
) {
  const extension = asset.name.split('.').pop()?.toLowerCase() ?? '';
  const type = types.get(extension);
  if (
    !type ||
    (asset.mimeType && asset.mimeType !== type && asset.mimeType !== 'application/octet-stream')
  )
    throw new UserFacingError('Selecciona una receta en PDF, JPG, PNG o WebP.');
  if (asset.size !== undefined && (asset.size <= 0 || asset.size > 8 * 1024 * 1024))
    throw new UserFacingError('La receta debe contener datos y pesar como máximo 8 MB.');
  const body = new FormData();
  const name = asset.name.replace(/[\\/\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g, '_');
  const part = { uri: asset.uri, name, type };
  // Expo 57 fetch reads bytes(), whereas RN networking serializes URI parts.
  // Hide the reader from RN's getParts() so no function is sent over the native bridge.
  Object.defineProperty(part, 'bytes', {
    enumerable: false,
    value:
      readBytes ??
      (async () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { File } = require('expo-file-system') as typeof import('expo-file-system');
        return new File(asset.uri).bytes();
      }),
  });
  body.append('file', part as unknown as Blob);
  return body;
}
export async function pickPrescription() {
  initializePrescriptionCache();
  // Defer native module initialization until the user requests a file.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const picker = require('expo-document-picker') as typeof import('expo-document-picker');
  const result = await picker.getDocumentAsync({
    type: Array.from(types.values()),
    multiple: false,
    copyToCacheDirectory: true,
  });
  return result.canceled ? null : preparePrescription(result.assets[0]);
}

export type PreparedPrescription = {
  body: FormData;
  preview: { uri: string; name: string; mimeType: string; size: number };
  dispose: () => void;
};
function matches(bytes: Uint8Array, signature: number[], offset = 0) {
  return signature.every((byte, index) => bytes[index + offset] === byte);
}
function contentMime(bytes: Uint8Array) {
  if (matches(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf';
  if (matches(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (matches(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (matches(bytes, [0x52, 0x49, 0x46, 0x46]) && matches(bytes, [0x57, 0x45, 0x42, 0x50], 8))
    return 'image/webp';
  return null;
}
function discardPickerCopy(fs: typeof import('expo-file-system'), uri: URL, directory: URL) {
  // Only the app-owned picker copy is safe to delete; never originals or ambiguous paths.
  if (
    uri.protocol !== 'file:' ||
    uri.host ||
    !uri.href.startsWith(directory.href) ||
    /%2f|%5c/i.test(uri.pathname)
  )
    return;
  try {
    const file = new fs.File(uri.href);
    if (file.exists) file.delete();
  } catch {
    /* OS cache eviction remains the fallback. */
  }
}
export function preparePrescription(asset: DocumentPickerAsset): PreparedPrescription {
  // Read only the app-owned copy made by DocumentPicker, never a remote URL or the user's original.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('expo-file-system') as typeof import('expo-file-system');
  const uri = new URL(asset.uri);
  const directory = new URL(
    'DocumentPicker/',
    fs.Paths.cache.uri.endsWith('/') ? fs.Paths.cache.uri : `${fs.Paths.cache.uri}/`,
  );
  if (
    uri.protocol !== 'file:' ||
    uri.host ||
    uri.search ||
    uri.hash ||
    !uri.href.startsWith(directory.href) ||
    /%2f|%5c/i.test(uri.pathname)
  ) {
    discardPickerCopy(fs, uri, directory);
    throw new UserFacingError('No pudimos preparar el archivo. Vuelve a seleccionarlo.');
  }
  const file = new fs.File(uri.href);
  const dispose = () => {
    // Best effort: cleanup must not turn a confirmed upload into a failed operation.
    try {
      if (file.exists) file.delete();
    } catch {
      /* OS cache eviction remains the fallback. */
    }
  };
  try {
    const size = file.size;
    if (!file.exists || !Number.isSafeInteger(size) || size <= 0 || size > 8 * 1024 * 1024)
      throw new UserFacingError('La receta debe contener datos y pesar como máximo 8 MB.');
    const handle = file.open(fs.FileMode.ReadOnly);
    let detected: string | null;
    try {
      detected = contentMime(handle.readBytes(Math.min(12, size)));
    } finally {
      handle.close();
    }
    const expected = types.get(asset.name.split('.').pop()?.toLowerCase() ?? '');
    if (!detected || detected !== expected)
      throw new UserFacingError(
        'El contenido del archivo no corresponde a una receta en PDF, JPG, PNG o WebP.',
      );
    return {
      body: prescriptionFormData({ ...asset, uri: uri.href, size }, () => file.bytes()),
      preview: { uri: uri.href, name: asset.name, mimeType: detected, size },
      dispose,
    };
  } catch (error) {
    dispose();
    if (error instanceof UserFacingError) throw error;
    throw new UserFacingError(
      'No pudimos leer el archivo. Vuelve a seleccionarlo e intenta de nuevo.',
    );
  }
}
