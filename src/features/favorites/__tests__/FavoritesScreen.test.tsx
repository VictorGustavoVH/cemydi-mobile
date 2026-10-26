import { screen } from '@testing-library/react-native';
import { render } from '../../../../tests/support/render-with-toast';
import { FavoritesScreen } from '../FavoritesScreen';
import { useFavorites } from '../hooks/useFavorites';
import { useAuth } from '@/providers/auth-provider';

jest.mock('../hooks/useFavorites');
jest.mock('@/providers/auth-provider', () => ({
  ...jest.requireActual('@/providers/auth-provider'),
  useAuth: jest.fn(),
}));
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(callback, [callback]);
  },
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    navigate: jest.fn(),
    canGoBack: () => true,
    back: jest.fn(),
  }),
}));

const mockAuth = useAuth as jest.Mock;
const mockFavorites = useFavorites as jest.Mock;

const mockProduct = {
  id: 1,
  slug: 'silla-de-ruedas',
  nombre: 'Silla de Ruedas Estándar',
  marca: 'CEMYDI Care',
  modelo: 'SR-100',
  descripcion: 'Silla ligera',
  clasificacion: 'Movilidad',
  precio: 2500,
  stock: 5,
  activo: true,
  tipoAdquisicion: 'VENTA' as const,
  requiereReceta: false,
  rentalDailyPrice: null,
  rentalMinDays: 1,
  rentalDeposit: 0,
  rentalTerms: null,
  medidas: null,
  pesoSoportado: null,
  material: null,
  contenidoCaja: null,
  indicacionesUso: null,
  imageUrl: 'https://images.test/silla.png',
  images: [],
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('FavoritesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('muestra el estado de inicio de sesión si el usuario no está autenticado', async () => {
    mockAuth.mockReturnValue({ user: null });
    mockFavorites.mockReturnValue({
      products: [],
      total: 0,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
      isFetching: false,
    });

    await render(<FavoritesScreen />);
    expect(screen.getByText('Inicia sesión para guardar favoritos')).toBeTruthy();
  });

  it('muestra el estado vacío si el usuario no tiene productos guardados', async () => {
    mockAuth.mockReturnValue({ user: { id: 1, nombre: 'Cliente Demo' } });
    mockFavorites.mockReturnValue({
      products: [],
      total: 0,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
      isFetching: false,
    });

    await render(<FavoritesScreen />);
    expect(screen.getByText('No tienes productos guardados')).toBeTruthy();
    expect(screen.getByText('Explorar catálogo')).toBeTruthy();
  });

  it('muestra la lista de productos guardados', async () => {
    mockAuth.mockReturnValue({ user: { id: 1, nombre: 'Cliente Demo' } });
    mockFavorites.mockReturnValue({
      products: [mockProduct],
      total: 1,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
      isFetching: false,
    });

    await render(<FavoritesScreen />);
    expect(screen.getByText('Mis favoritos')).toBeTruthy();
    expect(screen.getByText('1 producto guardado')).toBeTruthy();
    expect(screen.getByText('Silla de Ruedas Estándar')).toBeTruthy();
  });
});
