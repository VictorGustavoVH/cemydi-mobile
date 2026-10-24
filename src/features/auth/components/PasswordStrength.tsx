import { Text, View } from 'react-native';
import { colors } from '@/theme';
import { getPasswordRules } from '../schemas/auth-schemas';

export function PasswordStrength({ password }: { password: string }) {
  const rules = getPasswordRules(password);
  const score = password ? rules.filter((rule) => rule.met).length : 0;
  const label = ['Sin evaluar', 'Baja', 'Baja', 'Media', 'Alta'][score];
  const color = [colors.border, colors.danger, colors.danger, colors.warning, colors.success][
    score
  ];
  return (
    <View className="gap-3">
      <View
        accessible
        accessibilityLabel={`Seguridad de la contraseña: ${label}`}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 4, now: score, text: label }}
        className="gap-2"
      >
        <View className="flex-row gap-2">
          {rules.map((rule, index) => (
            <View
              key={rule.label}
              className="h-1 flex-1 rounded-full"
              style={{ backgroundColor: index < score ? color : colors.border }}
            />
          ))}
        </View>
        <Text className="font-sans-medium text-xs text-secondary">Seguridad: {label}</Text>
      </View>
    </View>
  );
}
