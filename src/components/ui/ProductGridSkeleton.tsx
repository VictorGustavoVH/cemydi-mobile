import { View, useWindowDimensions } from 'react-native';
import { Skeleton, SkeletonBlock } from './Skeleton';

type ProductGridSkeletonProps = {
  columns: number;
  count?: number;
  showDiscount?: boolean;
  showPrescription?: boolean;
};

export function ProductGridSkeleton({
  columns,
  count = 6,
  showDiscount = false,
  showPrescription = false,
}: ProductGridSkeletonProps) {
  const { fontScale } = useWindowDimensions();
  const safeColumns = Math.max(1, Math.floor(columns) || 1);
  const totalRows = Math.ceil(count / safeColumns);

  return (
    <Skeleton label="Cargando catálogo…">
      <View className="gap-4 px-5">
        {Array.from({ length: totalRows }, (_, row) => (
          <View key={row} className="flex-row gap-3">
            {Array.from({ length: safeColumns }, (_, column) => {
              const index = row * safeColumns + column;

              if (index >= count) {
                return <View key={column} className="flex-1" />;
              }

              return (
                <View
                  key={column}
                  className="flex-1 overflow-hidden rounded-xl border border-border-subtle bg-surface"
                >
                  {/* ETIQUETAS DE VENTA / RENTA */}
                  <View className="flex-row flex-wrap gap-1 p-2">
                    <SkeletonBlock className="w-12 rounded" style={{ height: 20 * fontScale }} />
                    <SkeletonBlock className="w-12 rounded" style={{ height: 20 * fontScale }} />
                  </View>
                  {/* IMAGEN 3:2 */}
                  <View
                    className="relative w-full bg-surface-muted"
                    style={{ aspectRatio: 3 / 2, maxHeight: 160 }}
                  >
                    <SkeletonBlock className="h-full w-full rounded-none" />
                  </View>

                  {/* INFORMACIÓN DEL PRODUCTO */}
                  <View className="flex-1 p-3">
                    {/* CAPTION Y CALIFICACIÓN */}
                    <View className="mb-2 flex-row items-center justify-between gap-2">
                      <View className="min-w-0 flex-1">
                        <SkeletonBlock
                          className="w-3/4 rounded"
                          style={{ height: 16 * fontScale }}
                        />
                      </View>
                      <View className="flex-row items-center justify-end gap-1">
                        <SkeletonBlock className="w-3 rounded" style={{ height: 16 * fontScale }} />
                        <SkeletonBlock className="w-6 rounded" style={{ height: 16 * fontScale }} />
                      </View>
                    </View>

                    {/* NOMBRE DEL PRODUCTO */}
                    <View className="gap-2">
                      <SkeletonBlock
                        className="w-full rounded"
                        style={{ height: 16 * fontScale }}
                      />
                      <SkeletonBlock className="w-4/5 rounded" style={{ height: 16 * fontScale }} />
                    </View>

                    {/* PRECIO */}
                    <View className="mt-3 gap-2">
                      {/* TIPO DE PRECIO */}
                      <SkeletonBlock className="w-2/3 rounded" style={{ height: 16 * fontScale }} />

                      {showDiscount ? (
                        <SkeletonBlock
                          className="w-1/2 rounded"
                          style={{ height: 16 * fontScale }}
                        />
                      ) : null}
                      {/* PRECIO ACTUAL */}
                      <SkeletonBlock className="w-3/4 rounded" style={{ height: 24 * fontScale }} />

                      {/* DESCUENTO OPCIONAL */}
                      {showDiscount ? (
                        <SkeletonBlock
                          className="w-12 rounded-full"
                          style={{ height: 20 * fontScale }}
                        />
                      ) : null}
                      {showPrescription ? (
                        <SkeletonBlock
                          className="w-4/5 rounded"
                          style={{ height: 20 * fontScale }}
                        />
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </Skeleton>
  );
}
