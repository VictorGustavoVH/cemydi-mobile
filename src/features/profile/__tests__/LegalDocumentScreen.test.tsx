import { fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { render } from '../../../../tests/support/render-with-toast';
import { installNetworkMock } from '../../../../tests/support/network-mock';
import { LegalDocumentScreen } from '../LegalDocumentScreen';
import { accountService } from '../account-service';
import { accountDate } from '../account-format';

let mockSlug = 'politicas-de-privacidad';
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ slug: mockSlug }),
  useRouter: () => ({ canGoBack: () => false, replace: jest.fn(), back: jest.fn() }),
  useFocusEffect: (callback: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(callback, [callback]);
  },
}));
const previousWebsite = process.env.EXPO_PUBLIC_WEBSITE_URL;
beforeEach(() => {
  installNetworkMock();
  process.env.EXPO_PUBLIC_WEBSITE_URL = 'https://cemydi.test';
  mockSlug = 'politicas-de-privacidad';
});
afterEach(() => {
  if (previousWebsite === undefined) delete process.env.EXPO_PUBLIC_WEBSITE_URL;
  else process.env.EXPO_PUBLIC_WEBSITE_URL = previousWebsite;
});
function document(updatedAt: string | null = '2026-11-22T12:00:00.000Z') {
  return {
    document: {
      slug: mockSlug as 'politicas-de-privacidad',
      title: 'Documento publicado',
      description: 'Contenido vigente',
      updatedAt,
      sections: [],
    },
  };
}

it.each(['politicas-de-privacidad', 'terminos-y-condiciones'])(
  'muestra la fecha real y abre únicamente la página web del documento %s',
  async (slug) => {
    mockSlug = slug;
    jest.spyOn(accountService, 'legal').mockResolvedValue(document());
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await render(<LegalDocumentScreen />);
    await screen.findByText(`Última actualización: ${accountDate('2026-11-22T12:00:00.000Z')}`);
    await fireEvent.press(screen.getByRole('button', { name: 'Abrir documento en el sitio web' }));
    expect(open).toHaveBeenCalledWith(`https://cemydi.test/${slug}`);
  },
);

it('no inventa la fecha de un documento predeterminado y maneja un fallo al abrir el navegador', async () => {
  jest.spyOn(accountService, 'legal').mockResolvedValue(document(null));
  jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('Navegador no disponible'));
  await render(<LegalDocumentScreen />);
  await screen.findByText('Fecha de actualización no publicada');
  await fireEvent.press(screen.getByRole('button', { name: 'Abrir documento en el sitio web' }));
  await screen.findByText('No se pudo abrir el documento en el sitio web. Intenta más tarde.');
});

it('no abre URLs si el origen configurado no es válido', async () => {
  process.env.EXPO_PUBLIC_WEBSITE_URL = 'javascript:alert(1)';
  jest.spyOn(accountService, 'legal').mockResolvedValue(document());
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await render(<LegalDocumentScreen />);
  await screen.findByText('Documento publicado');
  await fireEvent.press(screen.getByRole('button', { name: 'Abrir documento en el sitio web' }));
  await screen.findByText('No se pudo abrir el documento en el sitio web. Intenta más tarde.');
  expect(open).not.toHaveBeenCalled();
});

it('muestra el skeleton del documento durante la primera carga', async () => {
  jest.spyOn(accountService, 'legal').mockReturnValueOnce(new Promise<never>(() => {}));
  await render(<LegalDocumentScreen />);
  expect(screen.getByLabelText('Cargando documento')).toBeTruthy();
});
