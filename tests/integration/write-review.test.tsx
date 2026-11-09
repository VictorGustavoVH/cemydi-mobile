import { useEffect, type ComponentType } from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { render } from '../support/render-with-toast';
import { installAuthApiMock, AUTH_ACCOUNT, jsonResponse } from '../support/auth-api-mock';
import { installProfileApiMock } from '../support/profile-api-mock';
import { installNetworkMock } from '../support/network-mock';
import { productFixture } from '../support/product-fixtures';
import { useAuth } from '@/providers/auth-provider';
import { WriteReviewScreen } from '@/features/reviews/WriteReviewScreen';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { RegisterScreen } from '@/features/auth/RegisterScreen';
import { OtpScreen } from '@/features/auth/OtpScreen';
import { ReviewEntryButton } from '@/features/reviews/ReviewEntryButton';
import { reviewService, ownReviewKey } from '@/features/reviews/review-service';
import { ApiError } from '@/services/http/api-error';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  navigate: jest.fn(),
  canGoBack: jest.fn(() => true),
  back: jest.fn(),
  canDismiss: jest.fn(() => false),
  dismiss: jest.fn(),
};
let mockStack = ['(tabs)', 'producto/[id]'];
const mockNavigation = {
  dispatch: jest.fn(),
  getState: () => ({
    index: mockStack.length - 1,
    routes: mockStack.map((name) => ({ name: name.startsWith('/') ? name.slice(1) : name })),
  }),
};
const mockPreventRemove = jest.fn();
let mockProductId = '101';
jest.mock('expo-router', () => ({
  Redirect: () => null,
  useFocusEffect: (callback: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(callback, [callback]);
  },
  useRouter: () => mockRouter,
  useNavigation: () => mockNavigation,
  useLocalSearchParams: () => ({ productId: mockProductId }),
}));
jest.mock('expo-router/react-navigation', () => ({
  usePreventRemove: (...args: unknown[]) => mockPreventRemove(...args),
}));
let controls: ReturnType<typeof useAuth> & { client: QueryClient };
function Connected({
  Screen = WriteReviewScreen,
  login = true,
}: {
  Screen?: ComponentType;
  login?: boolean;
}) {
  const auth = useAuth();
  const client = useQueryClient();
  useEffect(() => {
    controls = { ...auth, client };
  }, [auth, client]);
  useEffect(() => {
    if (login) void auth.service.login(AUTH_ACCOUNT.correo, AUTH_ACCOUNT.password, false);
  }, [auth.service, login]);
  return <Screen />;
}
const existing = {
  id: 9,
  rating: 4,
  comment: 'Buen producto',
  status: 'APPROVED' as const,
  createdAt: '2026-10-31T12:00:00.000Z',
  updatedAt: '2026-10-31T12:00:00.000Z',
};
function api(initial: typeof existing | null = null, rejectFirst?: string) {
  let review: { rating: number; comment: string; status: string } | null = initial;
  const posts: unknown[] = [];
  const previous = jest.mocked(fetch).getMockImplementation();
  jest.mocked(fetch).mockImplementation(async (input, options) => {
    const path = new URL(String(input)).pathname;
    if (path === '/products/101') return jsonResponse({ product: productFixture(101) });
    if (path === '/reviews/product/101/mine')
      return jsonResponse({ review: review ? { ...existing, ...review } : null });
    if (path === '/reviews' && options?.method === 'POST') {
      const dto = JSON.parse(String(options.body)) as { rating: number; comment: string };
      posts.push(dto);
      if (rejectFirst) {
        const message = rejectFirst;
        rejectFirst = undefined;
        return jsonResponse({ message }, 400);
      }
      review = { ...dto, status: 'PENDING' };
      return jsonResponse({
        message: 'Reseña enviada y pendiente de moderación',
        review: { ...existing, ...review },
      });
    }
    if (previous) return previous(input, options);
    throw new Error('Petición sin fixture');
  });
  return posts;
}
beforeEach(() => {
  jest.clearAllMocks();
  mockRouter.canGoBack.mockReturnValue(true);
  mockProductId = '101';
  mockStack = ['(tabs)', 'producto/[id]'];
  installNetworkMock();
  installAuthApiMock();
  installProfileApiMock();
  api();
});
async function fill() {
  await fireEvent.press(await screen.findByRole('radio', { name: '5 estrellas' }));
  await fireEvent.changeText(screen.getByLabelText('Tu opinión'), '  Excelente atención  ');
}
it('cierra sin historial hacia el producto y evita la navegación de Perfil', async () => {
  mockRouter.canGoBack.mockReturnValue(false);
  await render(<Connected />);
  await screen.findByLabelText('Tu opinión');
  expect(screen.queryByLabelText('Volver')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Cerrar'));
  expect(mockRouter.replace).toHaveBeenCalledWith({
    pathname: '/producto/[id]',
    params: { id: '101' },
  });
  expect(mockRouter.replace).not.toHaveBeenCalledWith('/perfil');
});
it('crea una reseña pendiente y refresca reseñas propias y públicas', async () => {
  const posts = api();
  await render(<Connected />);
  await fill();
  const invalidate = jest.spyOn(controls.client, 'invalidateQueries');
  await fireEvent.press(screen.getByLabelText('Enviar reseña'));
  await screen.findByText('Tu reseña se envió y está en revisión.');
  expect(posts).toEqual([{ productId: 101, rating: 5, comment: 'Excelente atención' }]);
  expect(screen.getByDisplayValue('Excelente atención')).toBeTruthy();
  expect(screen.getByLabelText('Actualizar reseña')).toBeDisabled();
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['account', controls.user?.id, 'reviews'] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['reviews', 'product', '101'] });
  expect(mockPreventRemove).toHaveBeenLastCalledWith(false, expect.any(Function));
});
it('carga la reseña propia, permite editarla y conserva el borrador si el servidor rechaza contenido', async () => {
  api(existing, 'Tu reseña contiene lenguaje ofensivo. Reformúlala sin groserías.');
  await render(<Connected />);
  await screen.findByDisplayValue('Buen producto');
  expect(screen.getByLabelText('Actualizar reseña')).toBeDisabled();
  await fireEvent.changeText(
    screen.getByLabelText('Tu opinión'),
    'Comentario pendiente de corregir',
  );
  await fireEvent.press(screen.getByLabelText('Actualizar reseña'));
  expect(await screen.findByText(/Tu reseña contiene lenguaje ofensivo/)).toBeTruthy();
  expect(screen.getByDisplayValue('Comentario pendiente de corregir')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Actualizar reseña'));
  await screen.findByText('Tu reseña se envió y está en revisión.');
  expect(screen.getByText('En revisión')).toBeTruthy();
});
it('valida estrellas y texto antes de enviar', async () => {
  const posts = api();
  await render(<Connected />);
  await fireEvent.press(await screen.findByLabelText('Enviar reseña'));
  expect(screen.getByText('Selecciona una calificación.')).toBeTruthy();
  expect(screen.getByText('Escribe al menos 5 caracteres.')).toBeTruthy();
  expect(posts).toHaveLength(0);
});
it('conserva el borrador y rechaza etiquetas antes de hacer un POST', async () => {
  const posts = api();
  await render(<Connected />);
  await fill();
  const comment = '<img src="x" onerror="alert(1)">';
  await fireEvent.changeText(screen.getByLabelText('Tu opinión'), comment);
  await fireEvent.press(screen.getByLabelText('Enviar reseña'));
  expect(await screen.findByText('Escribe tu opinión solo con texto.')).toBeTruthy();
  expect(screen.getByDisplayValue(comment)).toBeTruthy();
  expect(posts).toHaveLength(0);
});
it('bloquea envíos offline y conserva el texto', async () => {
  const network = installNetworkMock();
  const posts = api();
  await render(<Connected />);
  await fill();
  await act(() => network.emit({ isInternetReachable: false }));
  expect(screen.getByLabelText('Enviar reseña')).toBeDisabled();
  expect(screen.getByDisplayValue('  Excelente atención  ')).toBeTruthy();
  expect(posts).toHaveLength(0);
});
it('evita doble envío y no repuebla caché privada después de logout', async () => {
  let finish!: (value: Awaited<ReturnType<typeof reviewService.submit>>) => void;
  const submit = jest.spyOn(reviewService, 'submit').mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  await render(<Connected />);
  await fill();
  await fireEvent.press(screen.getByLabelText('Enviar reseña'));
  await fireEvent.press(screen.getByLabelText('Enviar reseña'));
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  const owner = controls.user?.id;
  await act(async () => {
    await controls.logout();
    finish({ message: 'Guardada', review: { ...existing, status: 'PENDING' } });
  });
  expect(controls.client.getQueryData(ownReviewKey(owner, '101'))).toBeUndefined();
});
it('reintenta una lectura fallida y rechaza ids inválidos', async () => {
  jest
    .spyOn(reviewService, 'mine')
    .mockRejectedValueOnce(new ApiError('Error remoto', { kind: 'http', status: 500 }));
  const view = await render(<Connected />);
  await fireEvent.press(await screen.findByLabelText('Reintentar'));
  expect(await screen.findByLabelText('Tu opinión')).toBeTruthy();
  await view.unmount();
  mockProductId = '../otro';
  await render(<Connected />);
  expect(await screen.findByText('Producto no válido')).toBeTruthy();
});
function Entry() {
  return <ReviewEntryButton productId="101" />;
}
it('pide login al invitado sin alterar la pantalla de origen', async () => {
  await render(<Connected Screen={Entry} login={false} />);
  await waitFor(() => expect(controls.status).toBe('guest'));
  await fireEvent.press(screen.getByLabelText('Agregar reseña'));
  expect(mockRouter.push).toHaveBeenCalledWith('/login');
});

it('tras registro dirige a Perfil y permite retomar la reseña con la sesión activa', async () => {
  mockRouter.push.mockImplementation((href) => {
    mockStack.push(href);
  });
  mockRouter.replace.mockImplementation((href) => {
    mockStack[mockStack.length - 1] = href;
  });
  mockRouter.canDismiss.mockImplementation(() => mockStack.length > 1);
  mockRouter.dismiss.mockImplementation((count = 1) => {
    mockStack.splice(-count);
  });
  mockRouter.back.mockImplementation(() => {
    mockStack.pop();
  });
  const view = await render(<Connected Screen={Entry} login={false} />);
  await waitFor(() => expect(controls.status).toBe('guest'));
  await fireEvent.press(screen.getByLabelText('Agregar reseña'));
  await view.rerender(<Connected Screen={LoginScreen} login={false} />);
  await fireEvent.press(screen.getByLabelText('Regístrate'));
  await view.rerender(<Connected Screen={RegisterScreen} login={false} />);
  await fireEvent.changeText(screen.getByLabelText('Nombre completo'), 'Cliente nuevo');
  await fireEvent.changeText(screen.getByLabelText('Correo electrónico'), 'nuevo@cemydi.test');
  await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'Password12!');
  await fireEvent.changeText(screen.getByLabelText('Confirmar contraseña'), 'Password12!');
  await fireEvent.press(screen.getByRole('checkbox', { name: /Acepto los términos/ }));
  await fireEvent.press(screen.getByLabelText('Crear cuenta'));
  await waitFor(() => expect(mockStack.at(-1)).toBe('/otp'));
  await view.rerender(<Connected Screen={OtpScreen} login={false} />);
  await fireEvent.changeText(
    screen.getByLabelText('Código de verificación de 8 dígitos'),
    '00000000',
  );
  await fireEvent.press(screen.getByLabelText('Verificar código'));
  await waitFor(() => expect(mockStack.at(-1)).toBe('/login'));
  await view.rerender(<Connected Screen={LoginScreen} login={false} />);
  await fireEvent.changeText(screen.getByLabelText('Correo electrónico'), 'nuevo@cemydi.test');
  await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'Password12!');
  await fireEvent.press(screen.getByLabelText('Iniciar sesión'));
  await waitFor(() => expect(mockRouter.navigate).toHaveBeenCalledWith('/perfil'));
  expect(mockStack).toEqual(['(tabs)', 'producto/[id]']);
  expect(controls.status).toBe('authenticated');
  await view.rerender(<Connected Screen={Entry} login={false} />);
  await fireEvent.press(screen.getByLabelText('Agregar reseña'));
  await waitFor(() =>
    expect(mockStack.at(-1)).toEqual({
      pathname: '/perfil/resenas/[productId]',
      params: { productId: '101' },
    }),
  );
  await view.rerender(<Connected login={false} />);
  await fill();
  await fireEvent.press(screen.getByLabelText('Enviar reseña'));
  await screen.findByText('Tu reseña se envió y está en revisión.');
  await fireEvent.press(screen.getByLabelText('Cerrar'));
  expect(mockStack).toEqual(['(tabs)', 'producto/[id]']);
  expect(controls.status).toBe('authenticated');
  expect(mockRouter.dismiss).toHaveBeenCalledTimes(1);
});
