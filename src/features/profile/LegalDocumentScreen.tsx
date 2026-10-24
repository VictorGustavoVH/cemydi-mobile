import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProfileLayout } from './components/ProfileLayout';
import { AccountResourceState } from './components/AccountResourceState';
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
    <ProfileLayout
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
          <View className="gap-6 px-5 pb-8">
            <View className="gap-3">
              <Text accessibilityRole="header" className="font-sans-bold text-xl text-primary">
                {query.data?.document.title}
              </Text>
              <Text className="font-sans text-base leading-6 text-secondary">
                {query.data?.document.description}
              </Text>
            </View>
            {query.data?.document.sections.map((section) => (
              <View key={section.id} className="gap-3">
                <Text
                  accessibilityRole="header"
                  className="font-sans-semibold text-lg text-primary"
                >
                  {section.title}
                </Text>
                <Text
                  selectable
                  className={`font-sans text-base leading-7 ${section.variant === 'medical-alert' ? 'text-danger' : 'text-secondary'}`}
                >
                  {legalText(section.body)}
                </Text>
              </View>
            ))}
          </View>
        </AccountResourceState>
      )}
    </ProfileLayout>
  );
}
