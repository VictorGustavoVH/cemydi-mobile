import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SectionList, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import BellOff from 'lucide-react-native/icons/bell-off';
import Settings2 from 'lucide-react-native/icons/settings-2';
import { AppButton } from '@/components/ui/AppButton';
import { AppRefreshControl } from '@/components/ui/AppRefreshControl';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton, SkeletonBlock } from '@/components/ui/Skeleton';
import { AccountLayout } from '@/components/account/AccountLayout';
import { AccountResourceState } from '@/components/account/AccountResourceState';
import { useToast } from '@/hooks/useToast';
import { getFriendlyErrorMessage } from '@/services/http/api-error';
import { colors } from '@/theme';
import { notificationDestination } from './notification-destination';
import { useNotificationReadActions, useInfiniteNotifications } from './useNotifications';
import { NotificationRow } from './NotificationRow';
import { NotificationTabs, notificationFilters } from './NotificationTabs';
import { useNotificationPermissionAccess } from './useNotificationPermissionAccess';
import { UnreadBadge } from './UnreadBadge';
import { notificationSections } from './notification-presentation';

const SKELETON_ROWS = [
  { id: '1', titleWidth: 'w-3/4', bodyWidth: 'w-5/6', hasPreview: true },
  { id: '2', titleWidth: 'w-2/3', bodyWidth: 'w-4/5', hasPreview: false },
  { id: '3', titleWidth: 'w-4/5', bodyWidth: 'w-3/4', hasPreview: false },
  { id: '4', titleWidth: 'w-3/5', bodyWidth: 'w-5/6', hasPreview: true },
] as const;

function NotificationListSkeleton() {
  return (
    <Skeleton label="Cargando notificaciones">
      <View className="px-5 pb-6">
        <View className="flex-row items-center justify-between gap-3 pb-2 pt-4">
          <SkeletonBlock className="h-5 w-12 rounded" />
          <SkeletonBlock className="h-4 w-36 rounded" />
        </View>
        {SKELETON_ROWS.map((row) => (
          <View
            key={row.id}
            className="-mx-5 border-b border-border"
            style={{
              minHeight: 88,
              paddingHorizontal: 20,
              paddingVertical: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <SkeletonBlock
              className="h-11 w-11 shrink-0 rounded-full"
              style={{ borderRadius: 22 }}
            />
            <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
              <SkeletonBlock className={`h-4 ${row.titleWidth} rounded`} />
              <SkeletonBlock className="h-3 w-full rounded" />
              <SkeletonBlock className={`h-3 ${row.bodyWidth} rounded`} />
            </View>
            <View
              style={{
                alignSelf: 'stretch',
                minHeight: 52,
                minWidth: 48,
                flexShrink: 0,
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: 6,
              }}
            >
              <SkeletonBlock className="h-2 w-2 rounded-full" />
              {row.hasPreview ? <SkeletonBlock className="h-7 w-9 rounded-lg" /> : null}
              <SkeletonBlock className="h-3.5 w-14 rounded" />
            </View>
          </View>
        ))}
      </View>
    </Skeleton>
  );
}

export function NotificationsScreen() {
  const router = useRouter();
  const toast = useToast();
  const [category, setCategory] = useState('ALL');
  const actions = useNotificationReadActions();
  const requestPermission = useNotificationPermissionAccess();
  const { query, isOnline, allowed } = useInfiniteNotifications(
    category === 'ALL' ? undefined : category,
    actions.busy,
  );
  const data = query.data;
  const refreshEnabled = allowed && isOnline !== false && !actions.busy;
  const { refreshing, onRefresh } = usePullToRefresh(query.refetch, { enabled: refreshEnabled });
  useEffect(() => {
    if (allowed) requestPermission();
  }, [allowed, requestPermission]);
  const items = useMemo(
    () => [
      ...new Map(
        (data?.pages.flatMap((page) => page.items) ?? []).map((item) => [item.id, item]),
      ).values(),
    ],
    [data],
  );
  const unreadCount = data?.pages[0]?.unreadCount ?? 0;
  const dayStart = new Date().setHours(0, 0, 0, 0);
  const sections = useMemo(
    () => notificationSections(items, new Date(dayStart)),
    [items, dayStart],
  );
  const scrolled = useRef(false);
  const nextPending = useRef(false);
  const reducedMotion = useReducedMotion();
  const translation = useSharedValue(0);
  const opacity = useSharedValue(1);
  const previousCategory = useRef(category);
  const direction = useRef(1);
  useLayoutEffect(() => {
    if (!data || query.isPlaceholderData || query.isFetching || actions.busy) return;
    if (previousCategory.current === category) return;
    previousCategory.current = category;
    translation.set(reducedMotion ? 0 : direction.current * 16);
    opacity.set(reducedMotion ? 1 : 0.55);
    translation.set(withTiming(0, { duration: reducedMotion ? 0 : 180 }));
    opacity.set(withTiming(1, { duration: reducedMotion ? 0 : 180 }));
  }, [
    data,
    query.isPlaceholderData,
    query.isFetching,
    actions.busy,
    category,
    reducedMotion,
    opacity,
    translation,
  ]);
  const listStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateX: translation.get() }],
  }));
  const waiting = query.isPlaceholderData;
  const loadMore = () => {
    if (
      scrolled.current &&
      query.hasNextPage &&
      !nextPending.current &&
      !query.isFetching &&
      !query.isFetchNextPageError &&
      !waiting &&
      !actions.busy &&
      isOnline !== false
    ) {
      nextPending.current = true;
      void query.fetchNextPage({ cancelRefetch: false }).finally(() => {
        nextPending.current = false;
      });
    }
  };
  const markRead = (ids?: string[]) => {
    void actions.read(ids).catch((error) => toast.error(getFriendlyErrorMessage(error)));
  };
  return (
    <AccountLayout
      title="Notificaciones"
      titleAccessory={<UnreadBadge count={unreadCount} showZero />}
      scroll={false}
      action={
        <AppButton
          label="Preferencias de notificaciones"
          hideLabel
          variant="ghost"
          className="h-11 w-11 px-0"
          leftIcon={<Settings2 size={21} color={colors.textPrimary} aria-hidden />}
          onPress={() => router.push('/perfil/notificaciones/preferencias')}
        />
      }
    >
      <View className="px-5 pt-4">
        <NotificationTabs
          value={category}
          onChange={(id) => {
            const next = notificationFilters.findIndex(([key]) => key === id);
            const current = notificationFilters.findIndex(([key]) => key === category);
            direction.current = next > current ? 1 : -1;
            setCategory(id);
            scrolled.current = false;
          }}
        />
      </View>
      <AccountResourceState
        data={data}
        error={query.error}
        isError={query.isError}
        isOnline={isOnline}
        allowed={allowed}
        loadingFallback={<NotificationListSkeleton />}
        retry={() => void query.refetch()}
      >
        {data && (
          <Animated.View className="flex-1" style={listStyle}>
            {waiting ? (
              <NotificationListSkeleton />
            ) : (
              <SectionList
                refreshControl={
                  <AppRefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    enabled={refreshEnabled}
                  />
                }
                accessibilityLabel="Lista de notificaciones"
                sections={sections}
                stickySectionHeadersEnabled={false}
                renderSectionHeader={({ section }) => (
                  <View className="flex-row items-center justify-between gap-3 pb-2 pt-4">
                    <Text
                      accessibilityRole="header"
                      className="font-sans-semibold text-sm text-primary"
                    >
                      {section.title}
                    </Text>
                    {section.key === sections[0]?.key && unreadCount > 0 ? (
                      <AppButton
                        label="Marcar todas como leídas"
                        variant="unstyled"
                        className="active:opacity-70"
                        labelClassName="font-sans-medium text-xs text-brand-strong"
                        loading={actions.busy}
                        disabled={isOnline === false || unreadCount === 0 || !!waiting}
                        onPress={() => markRead()}
                      />
                    ) : null}
                  </View>
                )}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1 }}
                removeClippedSubviews={false}
                onScrollBeginDrag={() => {
                  scrolled.current = true;
                }}
                onEndReached={loadMore}
                onEndReachedThreshold={0.3}
                onScroll={({ nativeEvent }) => {
                  if (
                    nativeEvent.contentSize.height -
                      nativeEvent.contentOffset.y -
                      nativeEvent.layoutMeasurement.height <
                    240
                  )
                    loadMore();
                }}
                scrollEventThrottle={100}
                ListEmptyComponent={
                  <EmptyState
                    icon={
                      <View className="items-center justify-center pb-1">
                        <BellOff aria-hidden size={56} color={colors.disabled} strokeWidth={1.5} />
                      </View>
                    }
                    title="No tienes notificaciones en esta sección"
                    description="Los próximos avisos de CEMYDI aparecerán aquí."
                  />
                }
                renderItem={({ item }) => (
                  <View>
                    <NotificationRow
                      key={item.id}
                      item={item}
                      disabled={!!waiting}
                      readDisabled={actions.busy || isOnline === false}
                      onRead={() => markRead([item.id])}
                      onOpen={() => {
                        if (!item.readAt && !actions.busy && isOnline !== false)
                          markRead([item.id]);
                        const destination = notificationDestination(item);
                        if (destination) router.push(destination);
                      }}
                    />
                  </View>
                )}
                ListFooterComponent={
                  query.isFetchingNextPage ? (
                    <View
                      className="-mx-5 border-b border-border"
                      style={{
                        minHeight: 88,
                        paddingHorizontal: 20,
                        paddingVertical: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <Skeleton label="Cargando más notificaciones…">
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <SkeletonBlock
                            className="h-11 w-11 shrink-0 rounded-full"
                            style={{ borderRadius: 22 }}
                          />
                          <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                            <SkeletonBlock className="h-4 w-3/4 rounded" />
                            <SkeletonBlock className="h-3 w-full rounded" />
                          </View>
                          <SkeletonBlock className="h-3.5 w-14 rounded" />
                        </View>
                      </Skeleton>
                    </View>
                  ) : query.isFetchNextPageError ? (
                    <AppButton
                      label="Reintentar carga"
                      variant="ghost"
                      disabled={isOnline === false || actions.busy || query.isFetching}
                      onPress={() => void query.fetchNextPage({ cancelRefetch: false })}
                    />
                  ) : null
                }
              />
            )}
          </Animated.View>
        )}
      </AccountResourceState>
    </AccountLayout>
  );
}
