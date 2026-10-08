import { Linking, Text } from 'react-native';
import { useToast } from '@/hooks/useToast';

export function AuthTerms({ registration = false }: { registration?: boolean }) {
  const toast = useToast();
  async function openLegal(path: string) {
    const origin = process.env.EXPO_PUBLIC_WEBSITE_URL?.trim();
    if (!origin) {
      toast.error('No se pudo abrir la página. Intenta más tarde.');
      return;
    }
    try {
      const url = new URL(origin);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
        throw new Error('URL inválida');
      await Linking.openURL(new URL(path, url.origin).toString());
    } catch {
      toast.error('No se pudo abrir la página. Intenta más tarde.');
    }
  }
  return (
    <Text
      className={`font-sans text-sm leading-6 text-secondary ${registration ? '' : 'w-full text-center'}`}
    >
      {registration ? 'Acepto los ' : 'Consulta nuestros '}
      <Text
        accessibilityLabel="Términos y condiciones"
        accessibilityRole="link"
        className="font-sans-medium text-brand-strong underline"
        onPress={() => void openLegal('/terminos-y-condiciones')}
      >
        términos y condiciones
      </Text>
      {' y el '}
      <Text
        accessibilityLabel="Aviso de privacidad"
        accessibilityRole="link"
        className="font-sans-medium text-brand-strong underline"
        onPress={() => void openLegal('/politicas-de-privacidad')}
      >
        aviso de privacidad
      </Text>
      .
    </Text>
  );
}
