import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BackButton } from '@/components/ui/BackButton';
import { AppScreen } from '@/components/ui/AppScreen';
import { CatalogImage } from '@/components/ui/CatalogImage';
import { AuthIllustration, type AuthIllustrationKind } from './AuthIllustration';

type AuthLayoutProps = {
  title: string;
  description: string;
  children: ReactNode;
  illustration?: AuthIllustrationKind;
  backTo?: '/login' | '/forgot-password' | '/register' | '/otp' | '/inicio' | '/carrito';
};

export function AuthLayout({
  title,
  description,
  children,
  illustration,
  backTo,
}: AuthLayoutProps) {
  const router = useRouter();
  return (
    <AppScreen scroll edges={['top', 'bottom', 'left', 'right']} contentClassName="px-5 pb-6">
      <View className="w-full flex-1">
        <View className="min-h-12 flex-row items-center pt-1">
          {backTo ? <BackButton onPress={() => router.replace(backTo)} /> : null}
        </View>
        <View className="gap-3 pb-5 pt-2">
          {illustration ? (
            <AuthIllustration kind={illustration} />
          ) : (
            <CatalogImage
              label="Ortopedia CEMYDI"
              compact
              source={require('../../../../assets/branding/cemydi-logo-horizontal.png')}
              style={{ width: 156, height: 46, marginBottom: 8, alignSelf: 'center' }}
            />
          )}
          <Text
            accessibilityRole="header"
            className="w-full text-center font-sans-bold text-3xl tracking-tight text-primary"
          >
            {title}
          </Text>
          <Text className="w-full text-center font-sans text-sm leading-6 text-secondary">
            {description}
          </Text>
        </View>
        <View className="gap-4">{children}</View>
      </View>
    </AppScreen>
  );
}
