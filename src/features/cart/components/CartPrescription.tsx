import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import FileText from 'lucide-react-native/icons/file-text';
import Upload from 'lucide-react-native/icons/upload';
import { AppButton } from '@/components/ui/AppButton';
import { AppSpinner } from '@/components/ui/AppSpinner';
import { CatalogImage } from '@/components/ui/CatalogImage';
import { useCart } from '@/providers/cart-provider';
import type { ServerCartItem } from '../services/cart-service';
import { getFriendlyErrorMessage, UserFacingError } from '@/services/http/api-error';
import { colors } from '@/theme';
import { useToast } from '@/hooks/useToast';
import { pickPrescription, type PreparedPrescription } from '../prescription-picker';

type CartPrescriptionProps = { item: ServerCartItem; onBusyChange?: (busy: boolean) => void };
type LocalPreview = PreparedPrescription & { documentId?: string };

export function CartPrescription({ item, onBusyChange }: CartPrescriptionProps) {
  const {
    uploadPrescription,
    removePrescription,
    busy,
    online,
    uncertain,
    userId,
    authVersion,
    isCurrent,
  } = useCart();
  const [stage, setStage] = useState<'idle' | 'picking' | 'uploading' | 'removing'>('idle');
  const [local, setLocal] = useState<LocalPreview>();
  const [opening, setOpening] = useState(false);
  const localRef = useRef<LocalPreview | undefined>(undefined);
  const mounted = useRef(true);
  const lock = useRef(false);
  const openingLock = useRef(false);
  const toast = useToast();
  const disabled = busy || stage !== 'idle' || opening || !online || uncertain;
  const preview =
    local && (stage === 'uploading' || local.documentId === item.document?.id)
      ? local.preview
      : undefined;
  const document = preview
    ? { name: preview.name, mime: preview.mimeType, bytes: preview.size }
    : item.document
      ? {
          name: item.document.originalFilename,
          mime: item.document.mimeType,
          bytes: item.document.bytes,
        }
      : undefined;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (!lock.current && !openingLock.current) localRef.current?.dispose();
    };
  }, []);

  function clearPreview() {
    localRef.current?.dispose();
    localRef.current = undefined;
    if (mounted.current) setLocal(undefined);
  }

  async function update(remove = false) {
    if (lock.current || openingLock.current || disabled) return;
    lock.current = true;
    onBusyChange?.(true);
    const version = authVersion();
    setStage(remove ? 'removing' : 'picking');
    let prepared: PreparedPrescription | null = null;
    let uploaded = false;
    try {
      if (remove) {
        await removePrescription(item.id);
        clearPreview();
      } else {
        prepared = await pickPrescription();
        if (!prepared) return;
        if (!mounted.current || !isCurrent(userId, version))
          throw new UserFacingError('La sesión cambió. Vuelve a abrir el carrito.');
        clearPreview();
        const candidate: LocalPreview = prepared;
        localRef.current = candidate;
        setLocal(candidate);
        setStage('uploading');
        const result = await uploadPrescription(item.id, prepared.body);
        uploaded = true;
        candidate.documentId = result.document.id;
        if (mounted.current && isCurrent(userId, version)) setLocal({ ...candidate });
      }
      if (mounted.current && isCurrent(userId, version))
        toast.success(remove ? 'Receta retirada' : 'Receta adjuntada');
    } catch (error) {
      if (mounted.current && isCurrent(userId, version))
        toast.error(
          getFriendlyErrorMessage(
            error,
            remove
              ? 'No pudimos quitar la receta. Intenta de nuevo.'
              : 'No pudimos adjuntar la receta. Intenta de nuevo.',
          ),
        );
    } finally {
      if (prepared && (!uploaded || !mounted.current || !isCurrent(userId, version))) {
        if (localRef.current === prepared) clearPreview();
        else prepared.dispose();
      }
      lock.current = false;
      if (!mounted.current) clearPreview();
      if (mounted.current) {
        setStage('idle');
        onBusyChange?.(false);
      }
    }
  }

  async function openPdf() {
    if (!preview || openingLock.current || disabled) return;
    openingLock.current = true;
    setOpening(true);
    onBusyChange?.(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sharing = require('expo-sharing') as typeof import('expo-sharing');
      if (typeof sharing.isAvailableAsync !== 'function' || !(await sharing.isAvailableAsync()))
        throw new UserFacingError('No hay una aplicación disponible para abrir este PDF.');
      await sharing.shareAsync(preview.uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: 'Abrir receta con…',
      });
    } catch (error) {
      if (mounted.current) {
        const message =
          error instanceof Error && error.message.includes('Cannot find native module')
            ? 'La función de abrir PDF requiere reconstruir la app de desarrollo (módulo nativo pendiente).'
            : 'No pudimos abrir el PDF. Intenta de nuevo.';
        toast.error(message);
      }
    } finally {
      openingLock.current = false;
      if (!mounted.current) clearPreview();
      else {
        setOpening(false);
        onBusyChange?.(false);
      }
    }
  }

  return (
    <View className="gap-3 border-t border-border/50 pt-4">
      <Text className="font-sans-semibold text-base text-primary">Receta médica</Text>
      {document ? (
        <View className="gap-3">
          {preview?.mimeType.startsWith('image/') ? (
            <CatalogImage
              source={{ uri: preview.uri }}
              label={`Vista previa de ${preview.name}`}
              cachePolicy="none"
              style={{
                width: '100%',
                height: 200,
                borderRadius: 12,
                backgroundColor: colors.surfaceMuted,
              }}
            />
          ) : (
            <View className="items-center justify-center gap-2 rounded-xl bg-surface-muted py-6">
              <FileText aria-hidden size={36} color={colors.brandStrong} />
              <Text className="font-sans-semibold text-sm text-primary">
                {document.mime === 'application/pdf' ? 'Documento PDF' : 'Imagen adjunta'}
              </Text>
            </View>
          )}
          <View className="gap-1">
            <Text className="font-sans-medium text-sm text-primary">{document.name}</Text>
            <Text className="font-sans text-xs text-secondary">
              {document.mime === 'application/pdf'
                ? 'PDF'
                : document.mime.replace('image/', '').toUpperCase()}{' '}
              ·{' '}
              {document.bytes < 1024 * 1024
                ? `${Math.max(1, Math.ceil(document.bytes / 1024))} KB`
                : `${(document.bytes / (1024 * 1024)).toFixed(1)} MB`}
            </Text>
          </View>
          {preview?.mimeType === 'application/pdf' ? (
            <View className="gap-1">
              <AppButton
                label="Abrir PDF con otra aplicación"
                accessibilityHint="La aplicación que elijas tendrá acceso a tu receta y podría guardar una copia."
                variant="ghost"
                loading={opening}
                disabled={disabled}
                onPress={() => void openPdf()}
              />
              <Text className="font-sans text-xs leading-5 text-secondary">
                Al abrirla, la aplicación que elijas tendrá acceso a tu receta. CEMYDI no controla
                las copias que esa aplicación pueda guardar.
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <Text className="font-sans text-xs leading-5 text-secondary">
          PDF, JPG, PNG o WebP · Hasta 8 MB
        </Text>
      )}
      {stage === 'uploading' ? (
        <View accessibilityLiveRegion="polite" className="flex-row items-center gap-2">
          <AppSpinner size={20} label="Subiendo receta" />
          <Text className="flex-1 font-sans-medium text-sm text-brand-strong">
            Subiendo archivo…
          </Text>
        </View>
      ) : item.document ? (
        <Text
          accessibilityLiveRegion="polite"
          className="font-sans text-xs leading-5 text-secondary"
        >
          Archivo adjunto. CEMYDI lo revisará al recibir tu solicitud.
        </Text>
      ) : null}
      <AppButton
        label={`${item.document ? 'Cambiar' : 'Adjuntar'} receta`}
        accessibilityLabel={`${item.document ? 'Cambiar' : 'Adjuntar'} receta de ${item.product.nombre}`}
        variant="outline"
        disabled={disabled}
        onPress={() => void update()}
        leftIcon={<Upload aria-hidden size={18} color={colors.brandStrong} />}
      />
      {item.document ? (
        <AppButton
          label={stage === 'removing' ? 'Quitando receta…' : 'Quitar receta'}
          accessibilityLabel={`Quitar receta de ${item.product.nombre}`}
          variant="ghost"
          loading={stage === 'removing'}
          disabled={disabled}
          onPress={() => void update(true)}
        />
      ) : null}
    </View>
  );
}
