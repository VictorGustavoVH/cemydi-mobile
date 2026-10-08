import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { AppButton } from '@/components/ui/AppButton';

type OtpResendButtonProps = { resendAt: number; disabled: boolean; onResend: () => void };

export function OtpResendButton({ resendAt, disabled, onResend }: OtpResendButtonProps) {
  const [now, setNow] = useState(Date.now);
  const cooldown = Math.max(0, Math.ceil((resendAt - now) / 1000));
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    if (resendAt <= Date.now()) return;
    const interval = setInterval(() => {
      update();
      if (Date.now() >= resendAt) clearInterval(interval);
    }, 1000);
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') update();
    });
    return () => {
      clearInterval(interval);
      listener.remove();
    };
  }, [resendAt]);
  return (
    <AppButton
      label={cooldown > 0 ? `Reenviar en ${cooldown}s` : 'Reenviar código'}
      variant="ghost"
      labelClassName="text-sm text-brand-strong"
      disabled={disabled || cooldown > 0}
      onPress={() => {
        if (!disabled && Date.now() >= resendAt) onResend();
      }}
    />
  );
}
