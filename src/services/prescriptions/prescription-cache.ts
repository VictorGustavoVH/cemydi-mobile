import { UserFacingError } from '@/services/http/api-error';

let initialized = false;

/** Remove copies left by an earlier process, before this process can open a picker. */
export function initializePrescriptionCache(): void {
  if (initialized) return;
  try {
    // Keep native loading lazy, matching the document picker.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('expo-file-system') as typeof import('expo-file-system');
    const directory = new fs.Directory(fs.Paths.cache, 'DocumentPicker');
    const base = new URL(directory.uri.endsWith('/') ? directory.uri : `${directory.uri}/`);
    if (base.protocol !== 'file:' || base.host || base.search || base.hash)
      throw new Error('Invalid picker cache directory.');
    let failed = false;
    if (directory.exists) {
      for (const entry of directory.list()) {
        // Android's picker creates direct files. Never recurse or delete a supplied original.
        if (!(entry instanceof fs.File)) continue;
        const uri = new URL(entry.uri);
        const name = uri.pathname.slice(base.pathname.length);
        if (
          uri.protocol !== 'file:' ||
          uri.host ||
          uri.search ||
          uri.hash ||
          !uri.href.startsWith(base.href) ||
          !name ||
          name.includes('/') ||
          /%2f|%5c/i.test(uri.pathname)
        )
          continue;
        try {
          if (entry.exists) entry.delete();
        } catch {
          failed = true;
        }
      }
    }
    if (failed) throw new Error('Picker cache cleanup failed.');
    // Do not sweep again: uploads, previews and an external viewer may now own live copies.
    initialized = true;
  } catch {
    // Leave initialization pending so the next picker attempt can retry without exposing paths.
    throw new UserFacingError(
      'No pudimos limpiar los archivos temporales. Reintenta antes de adjuntar otra receta.',
    );
  }
}
