import { getDocumentAsync } from 'expo-document-picker';
import * as prescriptionCache from '@/services/prescriptions/prescription-cache';
import {
  pickPrescription,
  prescriptionFormData,
  preparePrescription,
} from '../prescription-picker';

const mockFile = { exists: true, size: 100, delete: jest.fn(), open: jest.fn() };
const mockHandle = { readBytes: jest.fn(), close: jest.fn() };
jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///cache/' } },
  Directory: jest.fn(() => ({ uri: 'file:///cache/DocumentPicker/', exists: false })),
  FileMode: { ReadOnly: 0 },
  File: jest.fn().mockImplementation(() => mockFile),
}));

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
const asset = {
  uri: 'file:///cache/DocumentPicker/fixture.pdf',
  name: 'receta.pdf',
  mimeType: 'application/pdf',
  size: 100,
  lastModified: 0,
};

describe('Selector de recetas', () => {
  beforeEach(() => {
    mockFile.exists = true;
    mockFile.size = 100;
    mockFile.open.mockReturnValue(mockHandle);
    mockHandle.readBytes.mockReturnValue(new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]));
  });
  it('no abre el selector si no pudo limpiar las copias del proceso anterior', async () => {
    jest.spyOn(prescriptionCache, 'initializePrescriptionCache').mockImplementationOnce(() => {
      throw new Error('No pudimos limpiar los archivos temporales.');
    });
    await expect(pickPrescription()).rejects.toThrow('No pudimos limpiar');
    expect(getDocumentAsync).not.toHaveBeenCalled();
  });
  it('DOC-01: permite cancelar sin crear un envío ni mostrar error', async () => {
    jest.mocked(getDocumentAsync).mockResolvedValueOnce({ canceled: true, assets: null });
    expect(await pickPrescription()).toBeNull();
  });
  it('codifica bytes y nombre con el serializador real de Expo 57 sin enviar funciones al puente RN', async () => {
    const { TextEncoder, TextDecoder } = jest.requireActual<{
      TextEncoder: new () => { encode: (text: string) => Uint8Array };
      TextDecoder: new () => { decode: (bytes: Uint8Array) => string };
    }>('node:util');
    const { default: NativeFormData } = jest.requireActual<{ default: typeof FormData }>(
      'react-native/Libraries/Network/FormData',
    );
    const { installFormDataPatch } = jest.requireActual<{
      installFormDataPatch: (form: typeof FormData) => void;
    }>('expo/src/winter/FormData');
    const { convertFormDataAsync } = jest.requireActual<{
      convertFormDataAsync: (form: FormData, boundary: string) => Promise<{ body: Uint8Array }>;
    }>('expo/src/winter/fetch/convertFormData');
    const previousFormData = globalThis.FormData;
    globalThis.FormData = NativeFormData;
    const nativeGetParts = (
      NativeFormData.prototype as unknown as {
        getParts: (this: FormData) => Record<string, unknown>[];
      }
    ).getParts;
    installFormDataPatch(FormData);
    const previousEncoder = Object.getOwnPropertyDescriptor(globalThis, 'TextEncoder');
    Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: TextEncoder });
    try {
      const bytes = new TextEncoder().encode('%PDF-1.7 fixture');
      const read = jest.fn(async () => bytes);
      const form = prescriptionFormData(asset, read);
      const nativeParts = nativeGetParts.call(form);
      expect(nativeParts[0].uri).toBe(asset.uri);
      expect(nativeParts[0].bytes).toBeUndefined();
      const encoded = await convertFormDataAsync(form, 'test-boundary');
      const text = new TextDecoder().decode(encoded.body);
      expect(text).toContain('name="file"; filename="receta.pdf"');
      expect(text).toContain('application/pdf');
      expect(text).toContain('%PDF-1.7 fixture');
      expect(text).not.toContain('file:///');
      expect(read).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.FormData = previousFormData;
      if (previousEncoder) Object.defineProperty(globalThis, 'TextEncoder', previousEncoder);
      else Reflect.deleteProperty(globalThis, 'TextEncoder');
    }
  });
  it('DOC-02: rechaza archivos vacíos, mayores de 8 MB y tipos inconsistentes antes de subir', () => {
    expect(() => prescriptionFormData({ ...asset, size: 0 })).toThrow('8 MB');
    expect(() => prescriptionFormData({ ...asset, size: 8 * 1024 * 1024 + 1 })).toThrow('8 MB');
    expect(() => prescriptionFormData({ ...asset, name: 'receta.exe' })).toThrow('PDF');
    expect(() => prescriptionFormData({ ...asset, mimeType: 'image/png' })).toThrow('PDF');
    expect(prescriptionFormData({ ...asset, size: 8 * 1024 * 1024 })).toBeInstanceOf(FormData);
  });
  it('comprueba el tamaño real aunque falten o mientan los metadatos', () => {
    mockFile.size = 8 * 1024 * 1024 + 1;
    expect(() => preparePrescription({ ...asset, size: undefined })).toThrow('8 MB');
    expect(mockFile.delete).toHaveBeenCalledTimes(1);
    expect(mockFile.open).not.toHaveBeenCalled();
    mockFile.size = 100;
    const prepared = preparePrescription({ ...asset, size: undefined });
    expect(prepared.body).toBeInstanceOf(FormData);
    expect(prepared.preview).toEqual({
      uri: asset.uri,
      name: asset.name,
      mimeType: 'application/pdf',
      size: 100,
    });
    expect(mockHandle.readBytes).toHaveBeenCalledWith(12);
    expect(mockHandle.close).toHaveBeenCalled();
    prepared.dispose();
    expect(mockFile.delete).toHaveBeenCalledTimes(2);
  });
  it('DOC-02b: rechaza contenido renombrado como PDF y limpia su copia temporal verificando magic bytes', () => {
    mockHandle.readBytes.mockReturnValue(new Uint8Array([60, 104, 116, 109, 108, 62]));
    expect(() => preparePrescription(asset)).toThrow('contenido');
    expect(mockHandle.close).toHaveBeenCalled();
    expect(mockFile.delete).toHaveBeenCalledTimes(1);
  });
  it('no lee ni borra URLs remotas, archivos originales o rutas fuera del selector', () => {
    for (const uri of [
      'https://example.invalid/receta.pdf',
      'file:///documents/receta.pdf',
      'file:///cache/DocumentPicker/../../original.pdf',
      'file:///cache/DocumentPicker/a%2fb.pdf',
    ]) {
      expect(() => preparePrescription({ ...asset, uri })).toThrow('preparar el archivo');
    }
    expect(mockFile.open).not.toHaveBeenCalled();
    expect(mockFile.delete).not.toHaveBeenCalled();
  });
  it('elimina la copia del selector cuando la ruta no es utilizable', () => {
    expect(() =>
      preparePrescription({ ...asset, uri: 'file:///cache/DocumentPicker/receta.pdf?copy=1' }),
    ).toThrow('preparar el archivo');
    expect(mockFile.delete).toHaveBeenCalledTimes(1);
    expect(mockFile.open).not.toHaveBeenCalled();
  });
  it('DOC-03: rechaza inconsistencias MIME y cierra el descriptor incluso si falla la lectura', () => {
    expect(() => preparePrescription({ ...asset, mimeType: 'text/html' })).toThrow('Selecciona');
    mockHandle.readBytes.mockImplementationOnce(() => {
      throw new Error('read failed');
    });
    expect(() => preparePrescription(asset)).toThrow('No pudimos leer');
    expect(mockHandle.close).toHaveBeenCalledTimes(2);
    expect(mockFile.delete).toHaveBeenCalledTimes(2);
  });
});
