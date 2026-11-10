import { File, Paths } from 'expo-file-system';
import { completeOnboarding, hasCompletedOnboarding } from '../onboarding-progress';

jest.mock('expo-file-system', () => ({
  File: jest.fn(),
  Paths: { document: { uri: 'file:///documents/' } },
}));

describe('progreso local de onboarding', () => {
  let exists: boolean;
  let contents: string;
  const create = jest.fn(() => {
    exists = true;
  });
  const write = jest.fn((value: string) => {
    contents = value;
  });
  const text = jest.fn(async () => contents);

  beforeEach(() => {
    exists = false;
    contents = '';
    jest.mocked(File).mockImplementation(
      () =>
        ({
          get exists() {
            return exists;
          },
          create,
          write,
          text,
        }) as unknown as File,
    );
    create.mockClear();
    write.mockClear();
    text.mockClear();
  });

  it('solo muestra la introducción mientras no exista la marca y no escribe antes de salir', async () => {
    expect(await hasCompletedOnboarding()).toBe(false);
    expect(create).not.toHaveBeenCalled();

    await completeOnboarding();
    expect(File).toHaveBeenCalledWith(Paths.document, 'cemydi-onboarding-completed-v1');
    expect(create).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith('1');
    expect(await hasCompletedOnboarding()).toBe(true);
  });

  it('conserva la marca al completar otra vez sin volver a crear el archivo', async () => {
    await completeOnboarding();
    await completeOnboarding();
    expect(create).toHaveBeenCalledTimes(1);
    expect(await hasCompletedOnboarding()).toBe(true);
  });

  it('no marca como terminado si el archivo está incompleto o falla la escritura', async () => {
    exists = true;
    contents = '';
    expect(await hasCompletedOnboarding()).toBe(false);
    write.mockImplementationOnce(() => {
      throw new Error('Sin espacio');
    });
    await expect(completeOnboarding()).rejects.toThrow('Sin espacio');
    expect(await hasCompletedOnboarding()).toBe(false);
  });
});
