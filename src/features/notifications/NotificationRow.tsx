import { useCallback, useState } from 'react';
import {
  Text,
  View,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
  type TextStyle,
} from 'react-native';
import Animated, {
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  withTiming,
} from 'react-native-reanimated';
import Tag from 'lucide-react-native/icons/tag';
import BellRing from 'lucide-react-native/icons/bell-ring';
import PackageCheck from 'lucide-react-native/icons/package-check';
import { AppButton } from '@/components/ui/AppButton';
import { CatalogImage } from '@/components/ui/CatalogImage';
import { colors } from '@/theme';
import type { CustomerNotification } from './notification-schemas';
import { notificationDestination } from './notification-destination';
import { notificationTime } from './notification-presentation';

const categories = {
  SYSTEM: { Icon: BellRing, color: colors.info },
  RENTAL: { Icon: PackageCheck, color: colors.brand },
  OFFER: { Icon: Tag, color: colors.danger },
};
const previewLines = 2;
const probeStyle: TextStyle = { position: 'absolute', left: 0, right: 0, top: 0, opacity: 0 };

/** Cuenta las líneas reales del texto sin recortar, para saber si la vista previa oculta contenido. */
function useRenderedLines() {
  const [lines, setLines] = useState(0);
  const measure = useCallback((event: NativeSyntheticEvent<TextLayoutEventData>) => {
    const count = event.nativeEvent.lines.length;
    setLines((current) => (current === count ? current : count));
  }, []);
  return { lines, measure };
}
type NotificationRowProps = {
  item: CustomerNotification;
  disabled?: boolean;
  readDisabled?: boolean;
  onOpen: () => void;
  onRead: () => void;
};
export function NotificationRow({
  item,
  disabled = false,
  readDisabled = false,
  onOpen,
  onRead,
}: NotificationRowProps) {
  const [expanded, setExpanded] = useState(false);
  const reducedMotion = useReducedMotion();
  const titleLines = useRenderedLines();
  const bodyLines = useRenderedLines();
  const unread = !item.readAt,
    duration = reducedMotion ? 0 : 200;
  const surfaceStyle = useAnimatedStyle(
    () => ({
      backgroundColor: withTiming(unread ? colors.background : colors.surfaceMuted, { duration }),
    }),
    [unread, duration],
  );
  const dotStyle = useAnimatedStyle(
    () => ({ opacity: withTiming(unread ? 1 : 0, { duration }) }),
    [unread, duration],
  );
  const { Icon, color } = categories[item.category];
  const destination = notificationDestination(item);
  const preview = item.category === 'OFFER' ? item.preview : null;
  const overflows = titleLines.lines > previewLines || bodyLines.lines > previewLines;
  const titleClassName = `${unread ? 'font-sans-bold text-primary' : 'font-sans-medium text-secondary'} text-sm leading-5`;
  const bodyClassName = 'font-sans text-xs leading-5 text-secondary';
  const revealFirst = destination && overflows && !expanded;
  return (
    <Animated.View
      className="border-b border-border"
      layout={LinearTransition.duration(reducedMotion ? 0 : 220)}
      style={surfaceStyle}
    >
      <AppButton
        label={`${item.title}${unread ? ', sin leer' : ''}`}
        accessibilityHint={`${item.body}. ${
          destination
            ? revealFirst
              ? 'Toca para ver el mensaje completo; un segundo toque abre su destino.'
              : 'Abre su destino.'
            : 'Toca para mostrar o contraer el mensaje completo.'
        }`}
        accessibilityState={destination && !overflows ? undefined : { expanded }}
        disabled={disabled}
        variant="unstyled"
        style={{
          alignSelf: 'stretch',
          minHeight: 88,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 8,
          paddingVertical: 14,
        }}
        onPress={() => {
          if (destination && !revealFirst) {
            onOpen();
            return;
          }
          setExpanded(!expanded);
          if (!expanded && unread && !readDisabled) onRead();
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: `${color}12`,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={23} strokeWidth={1.8} color={color} aria-hidden />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text
            numberOfLines={expanded ? undefined : previewLines}
            ellipsizeMode="tail"
            className={titleClassName}
          >
            {item.title}
          </Text>
          <Text
            numberOfLines={expanded ? undefined : previewLines}
            ellipsizeMode="tail"
            className={bodyClassName}
          >
            {item.body}
          </Text>
          <Text
            accessible={false}
            aria-hidden
            importantForAccessibility="no-hide-descendants"
            onTextLayout={titleLines.measure}
            className={titleClassName}
            style={probeStyle}
            testID="notification-title-measure"
          >
            {item.title}
          </Text>
          <Text
            accessible={false}
            aria-hidden
            importantForAccessibility="no-hide-descendants"
            onTextLayout={bodyLines.measure}
            className={bodyClassName}
            style={probeStyle}
            testID="notification-body-measure"
          >
            {item.body}
          </Text>
        </View>
        <View
          style={{
            alignSelf: 'stretch',
            minHeight: 52,
            minWidth: 48,
            maxWidth: 80,
            flexShrink: 0,
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 6,
          }}
        >
          <Animated.View
            accessible={false}
            style={[
              dotStyle,
              { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.info },
            ]}
          />
          {preview?.imageUrl ? (
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                overflow: 'hidden',
                backgroundColor: colors.background,
              }}
            >
              <CatalogImage
                source={{ uri: preview.imageUrl }}
                label={item.title}
                accessible={false}
                compact
              />
            </View>
          ) : preview?.discountPercent ? (
            <View
              style={{
                minWidth: 36,
                minHeight: 30,
                borderRadius: 8,
                backgroundColor: colors.background,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 4,
              }}
            >
              <Text className="font-sans-semibold text-xs" style={{ color }}>
                -{preview.discountPercent}%
              </Text>
            </View>
          ) : null}
          <Text className="font-sans text-[10px] text-secondary" style={{ textAlign: 'right' }}>
            {notificationTime(item.createdAt)}
          </Text>
        </View>
      </AppButton>
    </Animated.View>
  );
}
