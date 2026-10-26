import { useState } from 'react';
import { Text, View } from 'react-native';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import ChevronsLeft from 'lucide-react-native/icons/chevrons-left';
import ChevronsRight from 'lucide-react-native/icons/chevrons-right';
import { colors } from '@/theme';
import { AppButton } from './AppButton';
import { AppInput } from './AppInput';

type AppPaginationProps = {
  page: number;
  total: number;
  pageSize: number;
  disabled?: boolean;
  onPageChange: (page: number) => void;
};

export function AppPagination({
  page,
  total,
  pageSize,
  disabled = false,
  onPageChange,
}: AppPaginationProps) {
  const [target, setTarget] = useState('');
  const [jumpOpen, setJumpOpen] = useState(false);
  const [error, setError] = useState('');
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = Math.max(1, Math.min(page - 1, pages - 2));
  const numbers = Array.from({ length: Math.min(3, pages) }, (_, index) => start + index);
  const go = (next: number) => {
    if (!disabled && next >= 1 && next <= pages && next !== page) onPageChange(next);
  };
  const jump = () => {
    const next = Number(target);
    if (!/^\d+$/.test(target) || !Number.isSafeInteger(next) || next < 1 || next > pages) {
      setError(`Escribe una página del 1 al ${pages}.`);
      return;
    }
    go(next);
    setTarget('');
    setError('');
    setJumpOpen(false);
  };
  return (
    <View className="gap-3 border-t border-border pt-5">
      <Text
        accessibilityLiveRegion="polite"
        className="text-center font-sans text-xs text-secondary"
      >
        {total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)} de {total}{' '}
        resultados
      </Text>
      <View className="flex-row items-center justify-between gap-1">
        {[
          { label: 'Primera página', next: 1, Icon: ChevronsLeft, boundary: page <= 1 },
          { label: 'Página anterior', next: page - 1, Icon: ChevronLeft, boundary: page <= 1 },
        ].map(({ label, next, Icon, boundary }) => (
          <AppButton
            key={label}
            label={label}
            hideLabel
            variant="secondary"
            className="h-11 w-11 px-0"
            disabled={disabled || boundary || !total}
            onPress={() => go(next)}
            leftIcon={<Icon size={18} color={colors.textPrimary} aria-hidden />}
          />
        ))}
        <Text className="flex-1 text-center font-sans-medium text-sm text-primary">
          {page} / {pages}
        </Text>
        {[
          { label: 'Página siguiente', next: page + 1, Icon: ChevronRight },
          { label: 'Última página', next: pages, Icon: ChevronsRight },
        ].map(({ label, next, Icon }) => (
          <AppButton
            key={label}
            label={label}
            hideLabel
            variant="secondary"
            className="h-11 w-11 px-0"
            disabled={disabled || page >= pages || !total}
            onPress={() => go(next)}
            leftIcon={<Icon size={18} color={colors.textPrimary} aria-hidden />}
          />
        ))}
      </View>
      {pages > 1 && (
        <View className="flex-row flex-wrap items-center justify-center gap-1">
          {numbers.map((number) => (
            <AppButton
              key={number}
              label={String(number)}
              accessibilityLabel={`Página ${number}`}
              accessibilityState={{ selected: page === number }}
              variant={page === number ? 'primary' : 'ghost'}
              className="min-h-11 min-w-11 px-3"
              disabled={disabled}
              onPress={() => go(number)}
            />
          ))}
          <AppButton
            label="Ir a página"
            variant="ghost"
            disabled={disabled}
            accessibilityState={{ expanded: jumpOpen }}
            onPress={() => setJumpOpen(!jumpOpen)}
            labelClassName="text-sm"
          />
        </View>
      )}
      {jumpOpen && pages > 1 && (
        <View className="gap-2">
          <AppInput
            label={`Página de destino (1 a ${pages})`}
            value={target}
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
        </View>
      )}
    </View>
  );
}
