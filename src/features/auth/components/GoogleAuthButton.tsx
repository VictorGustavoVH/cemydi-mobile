import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { AppButton } from '@/components/ui/AppButton';
import { useToast } from '@/hooks/useToast';

export function GoogleAuthButton({ disabled = false }: { disabled?: boolean }) {
  const toast = useToast();
  return (
    <View className="gap-5">
      <View className="flex-row items-center gap-3">
        <View className="h-px flex-1 bg-border/60" />
        <Text className="font-sans text-sm text-secondary">o continúa con</Text>
        <View className="h-px flex-1 bg-border/60" />
      </View>
      <AppButton
        label="Continuar con Google"
        variant="secondary"
        disabled={disabled}
        className="min-h-14 rounded-2xl border border-border/70 bg-surface"
        labelClassName="font-sans-medium text-sm"
        onPress={() => toast.info('Próximamente disponible')}
        leftIcon={
          <Svg aria-hidden width={21} height={21} viewBox="0 0 16 16" fill="none">
            <Path
              fill="#4285F4"
              d="M14.9 8.161c0-.476-.039-.954-.121-1.422h-6.64v2.695h3.802a3.24 3.24 0 01-1.407 2.127v1.75h2.269c1.332-1.22 2.097-3.02 2.097-5.15z"
            />
            <Path
              fill="#34A853"
              d="M8.14 15c1.898 0 3.499-.62 4.665-1.69l-2.268-1.749c-.631.427-1.446.669-2.395.669-1.836 0-3.393-1.232-3.952-2.888H1.85v1.803A7.044 7.044 0 008.14 15z"
            />
            <Path
              fill="#FBBC04"
              d="M4.187 9.342a4.17 4.17 0 010-2.68V4.859H1.849a6.97 6.97 0 000 6.286l2.338-1.803z"
            />
            <Path
              fill="#EA4335"
              d="M8.14 3.77a3.837 3.837 0 012.7 1.05l2.01-1.999a6.786 6.786 0 00-4.71-1.82 7.042 7.042 0 00-6.29 3.858L4.186 6.66c.556-1.658 2.116-2.89 3.952-2.89z"
            />
          </Svg>
        }
      />
    </View>
  );
}
