import { useRouter } from 'expo-router';
import { AccountAccessBoundary } from './AccountAccessBoundary';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { AppScreen } from '@/components/ui/AppScreen';
import { BackButton } from '@/components/ui/BackButton';
import { useAuth } from '@/providers/auth-provider';
import { CredentialScreenProtection } from '@/components/security/CredentialScreenProtection';

type AccountLayoutProps = {
  title: string;
  titleAccessory?: ReactNode;
  children: ReactNode;
  main?: boolean;
  action?: ReactNode;
  publicAccess?: boolean;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  refreshEnabled?: boolean;
  protectCredentials?: boolean;
};
export function AccountLayout({
  title,
  titleAccessory,
  children,
  main = false,
  action,
  publicAccess = false,
  scroll = true,
  refreshing,
  onRefresh,
  refreshEnabled,
  protectCredentials = false,
}: AccountLayoutProps) {
  const { status, user } = useAuth();
  const router = useRouter();
  const content = (
    <AccountAccessBoundary publicAccess={publicAccess}>
      <AppScreen
        scroll={scroll}
        refreshing={refreshing}
        onRefresh={onRefresh}
        refreshEnabled={refreshEnabled}
        edges={main ? ['top', 'left', 'right'] : ['top', 'bottom', 'left', 'right']}
      >
        <View className="flex-row items-center gap-3 bg-background px-5 py-2">
          <BackButton
            fallbackHref={main || publicAccess ? '/inicio' : '/perfil'}
            onPress={main ? () => router.navigate('/inicio') : undefined}
          />
          <View className="min-w-0 flex-1 flex-row items-center justify-center gap-2">
            <Text
              accessibilityRole="header"
              className="min-w-0 shrink text-center font-sans-semibold text-xl text-primary"
            >
              {title}
            </Text>
            {titleAccessory}
          </View>
          {user && status === 'authenticated' && action ? action : <View className="w-11" />}
        </View>
        {children}
      </AppScreen>
    </AccountAccessBoundary>
  );
  return protectCredentials ? (
    <CredentialScreenProtection>{content}</CredentialScreenProtection>
  ) : (
    content
  );
}
