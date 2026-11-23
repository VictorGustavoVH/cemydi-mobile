import { Linking, Text, useWindowDimensions, View } from 'react-native';
import { AppButton } from '@/components/ui/AppButton';
import ExternalLink from 'lucide-react-native/icons/external-link';
import { colors } from '@/theme';
import { env, parseWebsiteUrl } from '@/config/env';
import { useToast } from '@/hooks/useToast';
import { accountDate } from './account-format';
import { useLocalSearchParams } from 'expo-router';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton, SkeletonBlock } from '@/components/ui/Skeleton';
import { AccountSection } from '@/components/account/AccountSection';
import { AccountLayout } from '@/components/account/AccountLayout';
import { AccountResourceState } from '@/components/account/AccountResourceState';
import { accountService, legalText, legalSlugs } from './account-service';
import { useAccountResource } from './useAccountResource';

function LegalDocumentSkeleton() {
  const { fontScale } = useWindowDimensions();
  return (
    <Skeleton label="Cargando documento">
      <View className="gap-7 px-5 pb-8 pt-5">
        <View className="gap-3">
          <SkeletonBlock className="w-3/4 rounded" style={{ height: 20 * fontScale }} />
          <View className="gap-2">
            <SkeletonBlock className="w-full rounded" style={{ height: 16 * fontScale }} />
            <SkeletonBlock className="w-5/6 rounded" style={{ height: 16 * fontScale }} />
          </View>
          <SkeletonBlock className="w-1/2 rounded" style={{ height: 12 * fontScale }} />
          <SkeletonBlock className="h-12 w-full rounded-xl" />
        </View>
        {[0, 1, 2].map((section) => (
          <View key={section} className="gap-3">
            <SkeletonBlock className="w-1/3 rounded" style={{ height: 16 * fontScale }} />
            <View className="gap-2">
              <SkeletonBlock className="w-full rounded" style={{ height: 14 * fontScale }} />
              <SkeletonBlock className="w-full rounded" style={{ height: 14 * fontScale }} />
              <SkeletonBlock className="w-4/5 rounded" style={{ height: 14 * fontScale }} />
              <SkeletonBlock className="w-2/3 rounded" style={{ height: 14 * fontScale }} />
            </View>
          </View>
        ))}
      </View>
    </Skeleton>
  );
}

export function LegalDocumentScreen() {
  const toast = useToast();
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const validSlug = legalSlugs.find((value) => value === slug);
  const { query, isOnline } = useAccountResource(
    ['legal', validSlug],
    (signal) => accountService.legal(validSlug!, signal),
    { enabled: Boolean(validSlug), publicAccess: true },
  );
  async function openWebsite() {
    if (!validSlug) return;
    try {
      const origin = parseWebsiteUrl(process.env.EXPO_PUBLIC_WEBSITE_URL, env.appEnv);
      if (!origin) throw new Error('Sitio no configurado');
      await Linking.openURL(new URL(`/${validSlug}`, origin).toString());
    } catch {
      toast.error('No se pudo abrir el documento en el sitio web. Intenta más tarde.');
    }
  }
  return (
    <AccountLayout
      title={validSlug === 'politicas-de-privacidad' ? 'Privacidad' : 'Términos y condiciones'}
      publicAccess
    >
      {!validSlug ? (
        <EmptyState
          title="Documento no disponible"
          description="Selecciona un documento desde Perfil."
        />
      ) : (
        <AccountResourceState
          {...query}
          isOnline={isOnline}
          loadingFallback={<LegalDocumentSkeleton />}
          retry={() => void query.refetch()}
        >
          <View className="gap-7 px-5 pb-8 pt-5">
            <View className="gap-3">
              <Text accessibilityRole="header" className="font-sans-bold text-xl text-primary">
                {query.data?.document.title}
              </Text>
              <Text className="font-sans text-base leading-6 text-secondary">
                {query.data?.document.description}
              </Text>
              <Text className="font-sans text-sm text-secondary">
                {query.data?.document.updatedAt
                  ? `Última actualización: ${accountDate(query.data.document.updatedAt)}`
                  : 'Fecha de actualización no publicada'}
              </Text>
              <AppButton
                label="Abrir documento en el sitio web"
                variant="outline"
                accessibilityHint="Abre este documento en el navegador."
                rightIcon={<ExternalLink aria-hidden size={18} color={colors.brandStrong} />}
                onPress={() => void openWebsite()}
              />
            </View>
            {query.data?.document.sections.map((section) => (
              <AccountSection key={section.id} title={section.title}>
                <Text
                  selectable
                  className={`font-sans text-base leading-7 ${section.variant === 'medical-alert' ? 'text-danger' : 'text-secondary'}`}
                >
                  {legalText(section.body)}
                </Text>
              </AccountSection>
            ))}
          </View>
        </AccountResourceState>
      )}
    </AccountLayout>
  );
}
