import { View } from 'react-native';
import Star from 'lucide-react-native/icons/star';
import { colors } from '@/theme';

type RatingStarsProps = { rating: number };

export function RatingStars({ rating }: RatingStarsProps) {
  return (
    <View accessible accessibilityLabel={`${rating} de 5 estrellas`} className="flex-row gap-1">
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          aria-hidden
          color={value <= rating ? colors.rating : colors.disabled}
          fill={value <= rating ? colors.rating : 'none'}
          size={14}
        />
      ))}
    </View>
  );
}
