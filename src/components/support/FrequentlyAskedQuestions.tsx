import { Text, View } from 'react-native';
import { AccountSection } from '@/components/account/AccountSection';

const questions = [
  {
    title: '¿Dónde consulto mis rentas?',
    answer: 'En Perfil, abre Mis rentas y selecciona una solicitud para ver su estado y detalle.',
  },
  {
    title: '¿Cómo cambio mis datos?',
    answer: 'Abre Datos personales, edita tu información y pulsa Guardar cambios.',
  },
  {
    title: '¿Cómo elimino mi cuenta?',
    answer:
      'En Perfil, abre Seguridad de la cuenta y pulsa Eliminar mi cuenta. Recibirás un código por correo para confirmar. Si tienes rentas o depósitos pendientes, la solicitud se completará al resolverlos.',
  },
  {
    title: '¿Olvidaste tu contraseña?',
    answer:
      'En el inicio de sesión, pulsa Olvidé mi contraseña para recuperar el acceso por correo.',
  },
] as const;

export function FrequentlyAskedQuestions() {
  return (
    <View className="gap-3">
      <Text accessibilityRole="header" className="font-sans-semibold text-lg text-primary">
        Preguntas frecuentes
      </Text>
      {questions.map(({ title, answer }) => (
        <View key={title} className="border-b border-border/50 pb-3">
          <AccountSection title={title} collapsible>
            <Text className="font-sans text-sm leading-6 text-secondary">{answer}</Text>
          </AccountSection>
        </View>
      ))}
    </View>
  );
}
