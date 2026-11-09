let mockEntries: unknown[] = [];
const mockDirectory = {
  uri: 'file:///cache/DocumentPicker/',
  exists: true,
  list: jest.fn(() => mockEntries),
};
const mockFileClass = class {
  exists = true;
  uri: string;
  delete = jest.fn(() => {
    this.exists = false;
  });
  constructor(uri: string) {
    this.uri = uri;
  }
};
jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///cache/' } },
  Directory: jest.fn(() => mockDirectory),
  File: mockFileClass,
}));

let initialize: typeof import('../prescription-cache').initializePrescriptionCache;
let FileType: typeof import('expo-file-system').File;
beforeEach(() => {
  mockEntries = [];
  mockDirectory.uri = 'file:///cache/DocumentPicker/';
  mockDirectory.exists = true;
  mockDirectory.list.mockReset().mockImplementation(() => mockEntries);
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    FileType = require('expo-file-system').File;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    initialize = require('../prescription-cache').initializePrescriptionCache;
  });
});

it('elimina las copias residuales de un proceso anterior, incluidos archivos parciales', () => {
  const pdf = new FileType('file:///cache/DocumentPicker/orphan.pdf');
  const partial = new FileType('file:///cache/DocumentPicker/incomplete.tmp');
  mockEntries = [pdf, partial];
  initialize();
  expect(pdf.delete).toHaveBeenCalledTimes(1);
  expect(partial.delete).toHaveBeenCalledTimes(1);
});

it('no crea un directorio inexistente ni vuelve a limpiar copias del proceso actual', () => {
  mockDirectory.exists = false;
  initialize();
  expect(mockDirectory.list).not.toHaveBeenCalled();
  mockDirectory.exists = true;
  const live = new FileType('file:///cache/DocumentPicker/live.pdf');
  mockEntries = [live];
  initialize();
  expect(live.delete).not.toHaveBeenCalled();
});

it('preserva originales, otras cachés, subdirectorios y rutas ambiguas', () => {
  const preserved = [
    'file:///documents/original.pdf',
    'file:///cache/other.pdf',
    'file:///cache/DocumentPicker-other/copy.pdf',
    'file:///cache/DocumentPicker/../original.pdf',
    'file:///cache/DocumentPicker/nested/copy.pdf',
    'file:///cache/DocumentPicker/a%2fb.pdf',
    'file:///cache/DocumentPicker/a%5cb.pdf',
    'file:///cache/DocumentPicker/copy.pdf?source=original',
    'file://remote/cache/DocumentPicker/copy.pdf',
    'https://example.invalid/file.pdf',
  ].map((uri) => new FileType(uri));
  const directory = { uri: 'file:///cache/DocumentPicker/nested/', delete: jest.fn() };
  mockEntries = [...preserved, directory];
  initialize();
  for (const entry of [...preserved, directory]) expect(entry.delete).not.toHaveBeenCalled();
});

it('intenta limpiar los demás archivos si uno falla y permite reintentar sin revelar rutas', () => {
  const first = new FileType('file:///cache/DocumentPicker/private-patient.pdf');
  const second = new FileType('file:///cache/DocumentPicker/other.pdf');
  jest.spyOn(first, 'delete').mockImplementationOnce(() => {
    throw new Error('private-patient.pdf: access denied');
  });
  mockEntries = [first, second];
  expect(() => initialize()).toThrow('No pudimos limpiar los archivos temporales.');
  expect(second.delete).toHaveBeenCalledTimes(1);
  expect(() => initialize()).not.toThrow();
  expect(first.delete).toHaveBeenCalledTimes(2);
});

it('no inicia la sesión de limpieza como completada si falla listar el directorio', () => {
  mockDirectory.list.mockImplementationOnce(() => {
    throw new Error('read denied');
  });
  expect(() => initialize()).toThrow('Reintenta antes de adjuntar');
  expect(() => initialize()).not.toThrow();
  expect(mockDirectory.list).toHaveBeenCalledTimes(2);
});
