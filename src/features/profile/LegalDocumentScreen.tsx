import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { EmptyState } from '@/components/ui/EmptyState';
import { AccountSection } from '@/components/account/AccountSection';
import { AccountLayout } from '@/components/account/AccountLayout';
import { AccountResourceState } from '@/components/account/AccountResourceState';
import { accountService, legalText, legalSlugs } from './account-service';
import { useAccountResource } from './useAccountResource';

export function LegalDocumentScreen() {
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const validSlug = legalSlugs.find((value) => value === slug);
  const { query, isOnline } = useAccountResource(
    ['legal', validSlug],
    (signal) => accountService.legal(validSlug!, signal),
    { enabled: Boolean(validSlug), publicAccess: true },
  );
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
        <AccountResourceState {...query} isOnline={isOnline} retry={() => void query.refetch()}>
          <View className="gap-7 px-5 pb-8 pt-5">
            <View className="gap-3">
              <Text accessibilityRole="header" className="font-sans-bold text-xl text-primary">
                {query.data?.document.title}
              </Text>
              <Text className="font-sans text-base leading-6 text-secondary">
                {query.data?.document.description}
              </Text>
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
