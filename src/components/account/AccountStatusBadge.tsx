import { Text, View } from 'react-native';
import Clock3 from 'lucide-react-native/icons/clock-3';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import CircleX from 'lucide-react-native/icons/circle-x';
import Ban from 'lucide-react-native/icons/ban';
import Truck from 'lucide-react-native/icons/truck';
import PackageCheck from 'lucide-react-native/icons/package-check';
import type { ReviewStatus } from '@/services/reviews/review-status';
import { colors } from '@/theme';
import { rentalLabels, type Rental } from '@/services/rentals/rental-schemas';

type StatusStyle = { Icon: typeof Clock3; color: string };
const rentalStyles: Record<Rental['status'], StatusStyle> = {
  PENDING: { Icon: Clock3, color: colors.warning },
  APPROVED: { Icon: CircleCheck, color: colors.success },
  REJECTED: { Icon: CircleX, color: colors.danger },
  CANCELLED: { Icon: Ban, color: colors.textSecondary },
  DELIVERED: { Icon: Truck, color: colors.info },
  RETURNED: { Icon: PackageCheck, color: colors.success },
};
const reviewStyles: Record<ReviewStatus, StatusStyle & { label: string }> = {
  PENDING: { Icon: Clock3, color: colors.warning, label: 'En revisión' },
  APPROVED: { Icon: CircleCheck, color: colors.success, label: 'Publicada' },
  REJECTED: { Icon: CircleX, color: colors.danger, label: 'No publicada' },
};
type AccountStatusBadgeProps = (
  { kind: 'rental'; status: Rental['status'] } | { kind: 'review'; status: ReviewStatus }
) & { appearance?: 'badge' | 'inline' };

export function AccountStatusBadge({
  kind,
  status,
  appearance = 'badge',
}: AccountStatusBadgeProps) {
  const { Icon, color } = kind === 'rental' ? rentalStyles[status] : reviewStyles[status];
  const label = kind === 'rental' ? rentalLabels[status] : reviewStyles[status].label;
  return (
    <View
      className={`max-w-full flex-row items-center gap-1.5 self-start ${appearance === 'badge' ? 'rounded-full bg-surface-muted px-2.5 py-1.5' : ''}`}
    >
      <Icon aria-hidden size={16} color={color} />
      <Text className="shrink font-sans-medium text-sm leading-5 text-primary">{label}</Text>
    </View>
  );
}
