import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

/** Optional native loading keeps written search usable in Expo Go. */
export function useVoiceSearch(onChange: (value: string) => void) {
  const [speech] = useState(() =>
    requireOptionalNativeModule<typeof ExpoSpeechRecognitionModule>('ExpoSpeechRecognition'),
  );
  const [listening, setListening] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const owned = useRef(false);
  const pending = useRef(false);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const cancel = useCallback(() => {
    generation.current += 1;
    pending.current = false;
    const wasOwned = owned.current;
    owned.current = false;
    if (wasOwned) speech?.abort();
    setListening(false);
    setRequesting(false);
  }, [speech]);

  useEffect(() => {
    if (!speech) return;
    const listeners = [
      speech.addListener('start', () => {
        if (owned.current) {
          setRequesting(false);
          setListening(true);
        }
      }),
      speech.addListener('result', (event) => {
        const text = event.results[0]?.transcript.trim();
        if (owned.current && text) onChangeRef.current(text.slice(0, 120));
      }),
      speech.addListener('end', () => {
        if (!owned.current) return;
        owned.current = false;
        setRequesting(false);
        setListening(false);
      }),
      speech.addListener('error', (event) => {
        if (!owned.current) return;
        owned.current = false;
        setRequesting(false);
        setListening(false);
        if (event.error !== 'aborted') {
          setError(
            event.error === 'not-allowed'
              ? 'Permite el micrófono y el reconocimiento de voz en los ajustes del dispositivo.'
              : event.error === 'no-speech'
                ? 'No escuchamos ninguna palabra. Vuelve a intentarlo o escribe tu búsqueda.'
                : 'No pudimos reconocer tu voz. Revisa la conexión o escribe tu búsqueda.',
          );
        }
      }),
    ];
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'background') cancel();
    });
    return () => {
      generation.current += 1;
      pending.current = false;
      listeners.forEach((listener) => listener.remove());
      appState.remove();
      if (owned.current) {
        owned.current = false;
        speech.abort();
      }
    };
  }, [cancel, speech]);

  const start = useCallback(async () => {
    if (pending.current || owned.current) return;
    setError(null);
    if (!speech) {
      return;
    }
    pending.current = true;
    const session = ++generation.current;
    setRequesting(true);
    try {
      if (!speech.isRecognitionAvailable()) {
        setError(
          'El reconocimiento de voz no está disponible en este dispositivo. Puedes escribir tu búsqueda.',
        );
        return;
      }
      const permission = await speech.requestPermissionsAsync();
      if (generation.current !== session) return;
      if (!permission.granted) {
        setError('Permite el micrófono y el reconocimiento de voz en los ajustes del dispositivo.');
        return;
      }
      owned.current = true;
      speech.start({
        lang: 'es-MX',
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
        iosTaskHint: 'search',
        recordingOptions: { persist: false },
      });
    } catch {
      if (generation.current === session) {
        owned.current = false;
        setRequesting(false);
        setListening(false);
        setError('No pudimos iniciar el micrófono. Vuelve a intentarlo o escribe tu búsqueda.');
      }
    } finally {
      if (generation.current === session) {
        pending.current = false;
        if (!owned.current) setRequesting(false);
      }
    }
  }, [speech]);
  const stop = useCallback(() => {
    if (owned.current) speech?.stop();
  }, [speech]);
  return { listening, requesting, error, start, stop, cancel };
}
