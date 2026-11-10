import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import type { ExpoSpeechRecognitionResultEvent } from 'expo-speech-recognition';
import { useVoiceSearch } from '../useVoiceSearch';
import { explainPermission } from '@/services/permission-rationale';
jest.mock('@/services/permission-rationale', () => ({
  explainPermission: jest.fn(() => Promise.resolve(true)),
}));

const mockRemove = jest.fn();
const mockSpeech = {
  addListener: jest.fn<
    { remove: () => void },
    [string, (event: ExpoSpeechRecognitionResultEvent) => void]
  >(() => ({ remove: mockRemove })),
  isRecognitionAvailable: jest.fn(() => true),
  requestPermissionsAsync: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true })),
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
    jest.mocked(explainPermission).mockResolvedValue(true);
    mockSpeech.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
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
      }),
    );
    expect(mockSpeech.start.mock.calls[0][0]).not.toHaveProperty('recordingOptions');
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

  it('no solicita permiso al sistema si se cancela la explicación', async () => {
    jest.mocked(explainPermission).mockResolvedValue(false);
    const { result } = await renderHook(() => useVoiceSearch(jest.fn()));
    await act(() => result.current.start());
    expect(mockSpeech.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockSpeech.start).not.toHaveBeenCalled();
    expect(result.current.requesting).toBe(false);
  });

  it('reutiliza el permiso concedido sin explicación ni solicitud nueva', async () => {
    mockSpeech.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
    const { result } = await renderHook(() => useVoiceSearch(jest.fn()));
    await act(() => result.current.start());
    expect(explainPermission).not.toHaveBeenCalled();
    expect(mockSpeech.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockSpeech.start).toHaveBeenCalled();
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

  it('informa errores de permisos de servicio y estado ocupado', async () => {
    const { result } = await renderHook(() => useVoiceSearch(jest.fn()));
    await act(async () => {
      await result.current.start();
    });
    const onError = mockSpeech.addListener.mock.calls.find(([event]) => event === 'error')?.[1];
    await act(() => onError?.({ error: 'service-not-allowed', message: 'Not allowed' } as never));
    expect(result.current.error).toMatch(/servicio de voz no permite/);

    await act(async () => {
      await result.current.start();
    });
    await act(() => onError?.({ error: 'busy', message: 'Busy' } as never));
    expect(result.current.error).toMatch(/ocupado por otra aplicación/);
  });

  it('MIC-05: informa que debe habilitarse en ajustes cuando el permiso está bloqueado permanentemente (canAskAgain: false)', async () => {
    mockSpeech.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });
    const { result } = await renderHook(() => useVoiceSearch(jest.fn()));
    await act(async () => {
      await result.current.start();
    });
    expect(explainPermission).not.toHaveBeenCalled();
    expect(mockSpeech.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockSpeech.start).not.toHaveBeenCalled();
    expect(result.current.error).toBe(
      'Permite el micrófono y el reconocimiento de voz en los ajustes del dispositivo.',
    );
    expect(result.current.requesting).toBe(false);
    expect(result.current.listening).toBe(false);
  });

  it('MIC-06: detecta la revocación del permiso en una búsqueda posterior tras haber sido concedido', async () => {
    mockSpeech.getPermissionsAsync.mockResolvedValueOnce({ granted: true, canAskAgain: true });
    const { result } = await renderHook(() => useVoiceSearch(jest.fn()));
    await act(async () => {
      await result.current.start();
    });
    expect(mockSpeech.start).toHaveBeenCalledTimes(1);
    await act(() => result.current.cancel());

    mockSpeech.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: true });
    mockSpeech.requestPermissionsAsync.mockResolvedValueOnce({ granted: false });
    await act(async () => {
      await result.current.start();
    });
    expect(explainPermission).toHaveBeenCalledTimes(1);
    expect(mockSpeech.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(result.current.error).toMatch(/Permite el micrófono/);
    expect(result.current.listening).toBe(false);
  });

  it('MIC-07: cancela la escucha y libera recursos cuando la app pasa a segundo plano (background)', async () => {
    let appStateListener: ((state: string) => void) | undefined;
    const addEventListenerSpy = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((event: string, handler: unknown) => {
        if (event === 'change') {
          appStateListener = handler as (state: string) => void;
        }
        return { remove: jest.fn() } as never;
      });

    mockSpeech.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
    const { result } = await renderHook(() => useVoiceSearch(jest.fn()));
    await act(async () => {
      await result.current.start();
    });
    const onStart = mockSpeech.addListener.mock.calls.find(([event]) => event === 'start')?.[1];
    await act(() => onStart?.({ isFinal: false, results: [] }));
    expect(result.current.listening).toBe(true);

    await act(() => {
      appStateListener?.('background');
    });

    expect(mockSpeech.abort).toHaveBeenCalled();
    expect(result.current.listening).toBe(false);
    expect(result.current.requesting).toBe(false);

    addEventListenerSpy.mockRestore();
  });
});
