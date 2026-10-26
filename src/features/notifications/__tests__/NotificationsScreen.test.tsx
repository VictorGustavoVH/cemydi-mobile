import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { NotificationsScreen } from '../NotificationsScreen';
import { useInfiniteNotifications, useNotificationReadActions } from '../useNotifications';

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(callback, [callback]);
  },
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('@/hooks/useToast', () => ({ useToast: () => ({ error: jest.fn() }) }));
jest.mock('../useNotificationPermissionAccess', () => ({
  useNotificationPermissionAccess: () => jest.fn(),
}));
jest.mock('@/features/profile/components/ProfileLayout', () => ({
  ProfileLayout: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('../useNotifications', () => ({
  useInfiniteNotifications: jest.fn(),
  useNotificationReadActions: jest.fn(),
}));
const fetchNextPage = jest.fn();
const read = jest.fn();
const item = {
  id: 'notice',
  category: 'OFFER',
  title: 'Oferta disponible',
  body: 'Consulta la promoción.',
  destinationType: 'NONE',
  destinationId: null,
  createdAt: new Date().toISOString(),
  readAt: null,
};
beforeEach(() => {
  jest.clearAllMocks();
  read.mockResolvedValue({ message: 'Leídas' });
  fetchNextPage.mockResolvedValue({});
  jest
    .mocked(useNotificationReadActions)
    .mockReturnValue({ busy: false, read } as unknown as ReturnType<
      typeof useNotificationReadActions
    >);
  jest.mocked(useInfiniteNotifications).mockReturnValue({
    allowed: true,
    isOnline: true,
    query: {
      data: {
        pages: [
          { items: [item], unreadCount: 2, page: 1, pageSize: 20, total: 21 },
          { items: [item], unreadCount: 2, page: 2, pageSize: 20, total: 21 },
        ],
      },
      hasNextPage: true,
      isFetching: false,
      isPlaceholderData: false,
      isError: false,
      fetchNextPage,
    },
  } as unknown as ReturnType<typeof useInfiniteNotifications>);
});
describe('notification scrolling', () => {
  it('waits for a scroll gesture before loading another page', async () => {
    await render(<NotificationsScreen />);
    const list = screen.getByLabelText('Lista de notificaciones');
    const event = {
      nativeEvent: {
        contentSize: { height: 1000, width: 390 },
        contentOffset: { x: 0, y: 600 },
        layoutMeasurement: { height: 800, width: 390 },
      },
    };
    await fireEvent.scroll(list, event);
    expect(fetchNextPage).not.toHaveBeenCalled();
    await fireEvent(list, 'scrollBeginDrag');
    await fireEvent.scroll(list, event);
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('tab', { name: 'Sistema' }));
    await fireEvent.scroll(list, event);
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });
  it('deduplicates overlapping pages and keeps global mark-all available', async () => {
    await render(<NotificationsScreen />);
    expect(screen.getAllByText(item.title)).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Marcar todas como leídas' }));
    expect(read).toHaveBeenCalledWith(undefined);
    expect(screen.queryByText(/Página \d/)).toBeNull();
    expect(screen.getByRole('header', { name: 'Hoy' })).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Marcar como leída: Oferta disponible' }),
    ).toBeNull();
  });
  it('uses the existing spinner while a different category is loading', async () => {
    const state = jest.mocked(useInfiniteNotifications)();
    jest.mocked(useInfiniteNotifications).mockReturnValue({
      ...state,
      query: { ...state.query, isPlaceholderData: true },
    } as ReturnType<typeof useInfiniteNotifications>);
    await render(<NotificationsScreen />);
    expect(screen.getByLabelText('Cargando notificaciones')).toBeTruthy();
    expect(screen.queryByText('Cargando sección…')).toBeNull();
    expect(screen.queryByText('Cargando notificaciones')).toBeNull();
  });
});
