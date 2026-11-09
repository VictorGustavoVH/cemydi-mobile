import { useState } from 'react';
import { Text, View } from 'react-native';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import ChevronsLeft from 'lucide-react-native/icons/chevrons-left';
import ChevronsRight from 'lucide-react-native/icons/chevrons-right';
import { colors } from '@/theme';
import { AppButton } from './AppButton';
import { AppSpinner } from './AppSpinner';
import { AppInput } from './AppInput';
import { AppSheet } from './AppSheet';

type AppPaginationProps = {
  page: number;
  totalPages: number;
  disabled?: boolean;
  loading?: boolean;
  onPageChange: (page: number) => void;
  className?: string;
};

/**
 * Paginación compacta de una sola fila: primera, anterior, página actual,
 * siguiente y última. El salto a una página concreta vive en una hoja, no
 * dentro del footer de la lista, para que el teclado no tape el campo.
 */
export function AppPagination({
  page,
  totalPages,
  disabled = false,
  loading = false,
  onPageChange,
  className = '',
}: AppPaginationProps) {
  const [jumpOpen, setJumpOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [error, setError] = useState('');
  const pages = Math.max(1, Math.floor(Number.isFinite(totalPages) ? totalPages : 1));
  const current = Math.min(Math.max(1, page), pages);
  const go = (next: number) => {
    if (disabled || next < 1 || next > pages || next === current) return;
    onPageChange(next);
  };
  const openJump = () => {
    setTarget(String(current));
    setError('');
    setJumpOpen(true);
  };
  const closeJump = () => {
    setJumpOpen(false);
    setTarget('');
    setError('');
  };
  const jump = () => {
    const value = target.trim();
    const next = Number(value);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(next) || next < 1 || next > pages) {
      setError(`Escribe una página del 1 al ${pages}.`);
      return;
    }
    closeJump();
    go(next);
  };
  return (
    <>
      <View className={`flex-row items-center gap-1 ${className}`}>
        <AppButton
          label="Primera página"
          hideLabel
          variant="secondary"
          className="h-11 w-11 px-0"
          disabled={disabled || current <= 1}
          onPress={() => go(1)}
          leftIcon={<ChevronsLeft size={18} color={colors.textPrimary} aria-hidden />}
        />
        <AppButton
          label="Página anterior"
          hideLabel
          variant="secondary"
          className="h-11 w-11 px-0"
          disabled={disabled || current <= 1}
          onPress={() => go(current - 1)}
          leftIcon={<ChevronLeft size={18} color={colors.textPrimary} aria-hidden />}
        />
        {loading ? (
          <View
            accessible
            accessibilityLabel="Cargando página"
            accessibilityLiveRegion="polite"
            className="min-h-11 flex-1 items-center justify-center"
          >
            <AppSpinner color={colors.brand} size={20} decorative />
          </View>
        ) : (
          <AppButton
            label={`Página ${current} de ${pages}`}
            accessibilityLabel={`Página ${current} de ${pages}`}
            accessibilityHint="Abre el salto a otra página"
            variant="ghost"
            className="min-h-11 flex-1 px-1"
            labelClassName="text-sm"
            disabled={disabled}
            onPress={openJump}
            rightIcon={<ChevronDown size={16} color={colors.textSecondary} aria-hidden />}
          />
        )}
        <AppButton
          label="Página siguiente"
          hideLabel
          variant="secondary"
          className="h-11 w-11 px-0"
          disabled={disabled || current >= pages}
          onPress={() => go(current + 1)}
          leftIcon={<ChevronRight size={18} color={colors.textPrimary} aria-hidden />}
        />
        <AppButton
          label="Última página"
          hideLabel
          variant="secondary"
          className="h-11 w-11 px-0"
          disabled={disabled || current >= pages}
          onPress={() => go(pages)}
          leftIcon={<ChevronsRight size={18} color={colors.textPrimary} aria-hidden />}
        />
      </View>
      <AppSheet title="Ir a una página" visible={jumpOpen} onClose={closeJump}>
        <Text className="font-sans text-sm leading-6 text-secondary">
          Elige una página entre 1 y {pages}.
        </Text>
        <AppInput
          autoFocus
          label={`Página de destino (1 a ${pages})`}
          value={target}
          valid={/^\d+$/.test(target.trim()) && Number(target) >= 1 && Number(target) <= pages}
          onChangeText={(value) => {
            setTarget(value);
            setError('');
          }}
          keyboardType="number-pad"
          returnKeyType="go"
          onSubmitEditing={jump}
          error={error || undefined}
          editable={!disabled}
        />
        <AppButton label="Ir" variant="secondary" disabled={disabled} onPress={jump} />
      </AppSheet>
    </>
  );
}
