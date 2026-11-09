import { Text, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { colors } from '@/theme';

type FormStepProgressProps = {
  step: 1 | 2;
  label?: string;
  steps?: readonly [string, string];
  tone?: 'brand' | 'danger';
};

export function FormStepProgress({
  step,
  label,
  steps = ['Verificación', 'Confirmación'],
  tone = 'brand',
}: FormStepProgressProps) {
  const reducedMotion = useReducedMotion();
  const color = tone === 'danger' ? colors.danger : colors.brandStrong;
  return (
    <View className="gap-3 py-2">
      <Text accessibilityLiveRegion="polite" className="font-sans-medium text-sm text-secondary">
        Paso {step} de 2{label ? ` · ${label}` : ''}
      </Text>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Progreso del formulario"
        accessibilityValue={{ min: 1, max: 2, now: step }}
        className="flex-row gap-3"
      >
        {([1, 2] as const).map((index) => (
          <View key={index} className="min-w-0 flex-1 gap-2">
            <View className="h-1.5 overflow-hidden rounded-full bg-border/40">
              <Animated.View
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: color,
                  opacity: step === index ? 1 : step > index ? 0.55 : 0,
                  transitionProperty: 'opacity',
                  transitionDuration: reducedMotion ? 0 : 180,
                }}
              />
            </View>
            <Text
              className="font-sans-medium text-sm"
              style={{ color: step === index ? color : colors.textSecondary }}
            >
              {index}. {steps[index - 1]}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
