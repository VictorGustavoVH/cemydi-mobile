import { useSafeNavigation } from '@/hooks/useSafeNavigation';
import StarPlus from 'lucide-react-native/icons/star-plus';
import { AppButton } from '@/components/ui/AppButton';
import { useAuth } from '@/providers/auth-provider';
import { colors } from '@/theme';
import { isReviewProductId } from './review-service';

type ReviewEntryButtonProps = {
  productId: string;
  label?: string;
  compact?: boolean;
  accessibilityLabel?: string;
};
export function ReviewEntryButton({
  productId,
  label = 'Agregar reseña',
  compact = false,
  accessibilityLabel,
}: ReviewEntryButtonProps) {
  const router = useSafeNavigation();
  const auth = useAuth();
  if (!isReviewProductId(productId)) return null;
  return (
    <AppButton
      label={label}
      accessibilityLabel={accessibilityLabel}
      variant={compact ? 'ghost' : 'outline'}
      className={compact ? 'self-start px-0' : undefined}
      disabled={auth.status === 'loading' || auth.status === 'error'}
      leftIcon={<StarPlus aria-hidden size={18} color={colors.brand} />}
      onPress={() => {
        if (auth.status !== 'authenticated' || !auth.user) {
          router.push('/login');
        } else router.push({ pathname: '/perfil/resenas/[productId]', params: { productId } });
      }}
    />
  );
}
