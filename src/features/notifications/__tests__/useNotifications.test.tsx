import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  onlineManager,
} from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { notificationService } from '../notification-service';
import {
  useInfiniteNotifications,
  useNotificationReadActions,
  useNotifications,
} from '../useNotifications';

jest.mock('@/providers/auth-provider', () => ({ useAuth: jest.fn() }));
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOnline: true }) }));
jest.mock('expo-router', () => ({ useFocusEffect: () => undefined }));
jest.mock('../notification-service', () => ({
  notificationService: { read: jest.fn(), readAll: jest.fn(), inbox: jest.fn() },
}));
const item = {
  id: 'notice',
  category: 'OFFER' as const,
  title: 'Oferta',
  body: 'Mensaje',
  destinationType: 'NONE' as const,
  destinationId: null,
  createdAt: new Date().toISOString(),
  readAt: null,
};
const inbox = { items: [item], unreadCount: 3, total: 21, page: 1, pageSize: 20 };
let client: QueryClient;
let currentId = 7;
const key = (page: number) => ['notifications', 7, 'inbox', page, undefined];
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
beforeEach(() => {
  currentId = 7;
  onlineManager.setOnline(true);
  focusManager.setFocused(true);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  jest.mocked(useAuth).mockReturnValue({
    user: { id: 7, rol: 'CLIENT' },
    status: 'authenticated',
    getSession: () => ({ user: { id: currentId } }),
    getSessionVersion: () => currentId,
  } as ReturnType<typeof useAuth>);
  jest.mocked(notificationService.read).mockResolvedValue({ message: 'Leídas' });
  jest.mocked(notificationService.readAll).mockResolvedValue({ message: 'Leídas' });
  jest.mocked(notificationService.inbox).mockResolvedValue(inbox);
});
afterEach(() => client.clear());

describe('optimistic notification reading', () => {
  it('appends pages in the infinite query and stops at the server total', async () => {
    jest.mocked(notificationService.inbox).mockImplementation(async (page = 1) => ({
      ...inbox,
      page,
      items: [{ ...item, id: `notice-${page}` }],
    }));
    const { result } = await renderHook(
      () => {
        const state = useInfiniteNotifications();
        return { ...state, data: state.query.data, hasNext: state.query.hasNextPage };
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));
    expect(result.current.hasNext).toBe(true);
    await act(async () => {
      await result.current.query.fetchNextPage();
    });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(
      result.current.data?.pages.flatMap((page) => page.items.map((notice) => notice.id)),
    ).toEqual(['notice-1', 'notice-2']);
    expect(result.current.hasNext).toBe(false);
  });
  it('updates every infinite page once and restores the whole feed on failure', async () => {
    const infiniteKey = ['notifications', 7, 'inbox', 'infinite', undefined];
    const cached = { pages: [inbox, { ...inbox, page: 2 }], pageParams: [1, 2] };
    client.setQueryData(infiniteKey, cached);
    let reject!: (error: Error) => void;
    jest.mocked(notificationService.read).mockReturnValueOnce(
      new Promise((_, fail) => {
        reject = fail;
      }),
    );
    const { result } = await renderHook(() => useNotificationReadActions(), { wrapper });
    let operation!: Promise<unknown>;
    await act(async () => {
      operation = result.current.read(['notice']).catch((error) => error);
    });
    await waitFor(() =>
      expect(client.getQueryData(infiniteKey)).toMatchObject({
        pages: [
          { unreadCount: 2, items: [{ readAt: expect.any(String) }] },
          { unreadCount: 2, items: [{ readAt: expect.any(String) }] },
        ],
      }),
    );
    await act(async () => {
      reject(new Error('Offline'));
      await operation;
    });
    expect(client.getQueryData(infiniteKey)).toEqual(cached);
  });
  it('updates every cached page immediately, deduplicates counts and rolls back on failure', async () => {
    client.setQueryData(key(1), inbox);
    client.setQueryData(key(2), { ...inbox, page: 2 });
    let reject!: (error: Error) => void;
    jest.mocked(notificationService.read).mockReturnValueOnce(
      new Promise((_, fail) => {
        reject = fail;
      }),
    );
    const { result } = await renderHook(() => useNotificationReadActions(), { wrapper });
    let operation!: Promise<unknown>;
    await act(async () => {
      operation = result.current.read(['notice']).catch((error) => error);
    });
    await waitFor(() =>
      expect(client.getQueryData(key(1))).toMatchObject({
        unreadCount: 2,
        items: [{ readAt: expect.any(String) }],
      }),
    );
    expect(client.getQueryData(key(2))).toMatchObject({
      unreadCount: 2,
      items: [{ readAt: expect.any(String) }],
    });
    await act(async () => {
      reject(new Error('Offline'));
      await operation;
    });
    expect(client.getQueryData(key(1))).toEqual(inbox);
    expect(client.getQueryData(key(2))).toMatchObject({
      unreadCount: 3,
      items: [{ readAt: null }],
    });
  });
  it('marks the full inbox optimistically while leaving another account untouched', async () => {
    client.setQueryData(key(1), inbox);
    const other = ['notifications', 8, 'inbox', 1, undefined];
    client.setQueryData(other, inbox);
    const { result } = await renderHook(() => useNotificationReadActions(), { wrapper });
    await act(async () => {
      await result.current.read();
    });
    expect(client.getQueryData(key(1))).toMatchObject({
      unreadCount: 0,
      items: [{ readAt: expect.any(String) }],
    });
    expect(client.getQueryData(other)).toEqual(inbox);
    expect(notificationService.readAll).toHaveBeenCalledTimes(1);
  });
  it('retains the old list while changing filters but never carries it into another account', async () => {
    const { result, rerender } = await renderHook<
      ReturnType<typeof useNotifications>,
      { category: string | undefined }
    >(
      ({ category }) => {
        const state = useNotifications(1, category);
        return { ...state, data: state.query.data };
      },
      {
        initialProps: { category: undefined as string | undefined },
        wrapper,
      },
    );
    await waitFor(() => expect(result.current.query.data).toEqual(inbox));
    let finish!: (data: typeof inbox) => void;
    jest.mocked(notificationService.inbox).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await rerender({ category: 'SYSTEM' });
    expect(result.current.query.data).toEqual(inbox);
    expect(result.current.query.isPlaceholderData).toBe(true);
    jest
      .mocked(useAuth)
      .mockReturnValue({ user: { id: 8, rol: 'CLIENT' }, status: 'authenticated' } as ReturnType<
        typeof useAuth
      >);
    jest.mocked(notificationService.inbox).mockReturnValueOnce(new Promise(() => undefined));
    await rerender({ category: 'OFFER' });
    expect(result.current.query.data).toBeUndefined();
    await act(async () => finish(inbox));
    expect(result.current.query.data).toBeUndefined();
  });
});
