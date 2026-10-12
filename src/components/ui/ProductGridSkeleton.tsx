import { View } from 'react-native';
import { Skeleton, SkeletonBlock } from './Skeleton';

type ProductGridSkeletonProps = {
  columns: number;
  count?: number;
};

export function ProductGridSkeleton({ columns, count = 6 }: ProductGridSkeletonProps) {
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
                  className="flex-1 overflow-hidden rounded-xl border border-[#e7edef] bg-white"
                >
                  {/* IMAGEN CUADRADA */}
                  <View
                    className="relative w-full border-b border-[#edf2f3] bg-[#fbfcfc]"
                    style={{ aspectRatio: 1 }}
                  >
                    <SkeletonBlock className="h-full w-full rounded-none" />

                    {/* ETIQUETAS DE VENTA / RENTA */}
                    <View className="absolute left-2 top-2 flex-row gap-1">
                      <SkeletonBlock className="h-5 w-12 rounded" />
                      <SkeletonBlock className="h-5 w-12 rounded" />
                    </View>
                  </View>

                  {/* INFORMACIÓN DEL PRODUCTO */}
                  <View className="flex-1 p-3">
                    {/* CAPTION Y CALIFICACIÓN */}
                    <View className="mb-2 flex-row items-center justify-between gap-2">
                      <View className="min-w-0 flex-1">
                        <SkeletonBlock className="h-3 w-3/4 rounded" />
                      </View>

                      <View className="flex-row items-center gap-1">
                        <SkeletonBlock className="h-3 w-3 rounded" />
                        <SkeletonBlock className="h-3 w-6 rounded" />
                      </View>
                    </View>

                    {/* NOMBRE DEL PRODUCTO */}
                    <View className="gap-2">
                      <SkeletonBlock className="h-4 w-full rounded" />
                      <SkeletonBlock className="h-4 w-4/5 rounded" />
                    </View>

                    {/* PRECIO */}
                    <View className="mt-3 gap-2">
                      {/* TIPO DE PRECIO */}
                      <SkeletonBlock className="h-3 w-2/3 rounded" />

                      {/* PRECIO ACTUAL */}
                      <SkeletonBlock className="h-6 w-3/4 rounded" />

                      {/* DESCUENTO OPCIONAL */}
                      <SkeletonBlock className="h-4 w-12 rounded-full" />
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
