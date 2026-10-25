import { act, renderHook } from '@testing-library/react-native';
import type { ExpoSpeechRecognitionResultEvent } from 'expo-speech-recognition';
import { useVoiceSearch } from '../useVoiceSearch';

const mockRemove = jest.fn();
const mockSpeech = {
  addListener: jest.fn<
    { remove: () => void },
    [string, (event: ExpoSpeechRecognitionResultEvent) => void]
  >(() => ({ remove: mockRemove })),
  isRecognitionAvailable: jest.fn(() => true),
  requestPermissionsAsync: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  abort: jest.fn(),
};
jest.mock('expo', () => ({
  ...jest.requireActual('expo'),
  requireOptionalNativeModule: () => mockSpeech,
}));

describe('useVoiceSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSpeech.isRecognitionAvailable.mockReturnValue(true);
    mockSpeech.requestPermissionsAsync.mockResolvedValue({ granted: true });
  });

  it('pide permisos una vez, dicta en español y permite detenerse', async () => {
    const onChange = jest.fn();
    const { result, unmount } = await renderHook(() => useVoiceSearch(onChange));
    await act(async () => {
      await Promise.all([result.current.start(), result.current.start()]);
    });
    expect(mockSpeech.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mockSpeech.start).toHaveBeenCalledWith(
      expect.objectContaining({
        lang: 'es-MX',
        recordingOptions: { persist: false },
      }),
    );
    expect(result.current.requesting).toBe(true);
    expect(result.current.listening).toBe(false);
    const onStart = mockSpeech.addListener.mock.calls.find(([event]) => event === 'start')?.[1];
    await act(() => onStart?.({ isFinal: false, results: [] }));
    expect(result.current.requesting).toBe(false);
    expect(result.current.listening).toBe(true);
    const callback = mockSpeech.addListener.mock.calls.find(([event]) => event === 'result')?.[1];
    const transcript: ExpoSpeechRecognitionResultEvent = {
      isFinal: true,
      results: [{ transcript: 'silla de ruedas', confidence: 1, segments: [] }],
    };
    await act(() => callback?.(transcript));
    expect(onChange).toHaveBeenCalledWith('silla de ruedas');
    await act(() => result.current.stop());
    expect(mockSpeech.stop).toHaveBeenCalledTimes(1);
    await unmount();
    expect(mockRemove).toHaveBeenCalledTimes(4);
    expect(mockSpeech.abort).toHaveBeenCalledTimes(1);
  });

  it('no inicia ni borra texto si el permiso se deniega', async () => {
    mockSpeech.requestPermissionsAsync.mockResolvedValue({ granted: false });
    const onChange = jest.fn();
    const { result } = await renderHook(() => useVoiceSearch(onChange));
    await act(() => result.current.start());
    expect(mockSpeech.start).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/Permite el micrófono/);
    expect(result.current.requesting).toBe(false);
  });

  it('ignora permisos que llegan después de cerrar el buscador', async () => {
    let resolvePermission!: (value: { granted: boolean }) => void;
    mockSpeech.requestPermissionsAsync.mockReturnValue(
      new Promise((resolve) => {
        resolvePermission = resolve;
      }),
    );
    const { result } = await renderHook(() => useVoiceSearch(jest.fn()));
    let request!: Promise<void>;
    await act(() => {
      request = result.current.start();
    });
    await act(() => result.current.cancel());
    await act(async () => {
      resolvePermission({ granted: true });
      await request;
    });
    expect(mockSpeech.start).not.toHaveBeenCalled();
    expect(result.current.listening).toBe(false);
  });

  it('ofrece búsqueda escrita si no existe servicio de voz', async () => {
    mockSpeech.isRecognitionAvailable.mockReturnValue(false);
    const { result } = await renderHook(() => useVoiceSearch(jest.fn()));
    await act(() => result.current.start());
    expect(result.current.error).toMatch(/no está disponible/);
    expect(mockSpeech.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});
