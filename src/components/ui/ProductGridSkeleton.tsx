import { View } from 'react-native';
import { Skeleton, SkeletonBlock } from './Skeleton';

type ProductGridSkeletonProps = { columns: number; count?: number };

export function ProductGridSkeleton({ columns, count = 6 }: ProductGridSkeletonProps) {
  return (
    <Skeleton label="Cargando catálogo…">
      <View className="gap-4 px-5">
        {Array.from({ length: Math.ceil(count / columns) }, (_, row) => (
          <View key={row} className="flex-row gap-3">
            {Array.from({ length: columns }, (_, column) => (
              <View
                key={column}
                className="flex-1 overflow-hidden rounded-2xl border border-border/50"
              >
                <View style={{ aspectRatio: 3 / 2, maxHeight: 160 }}>
                  <SkeletonBlock className="h-full w-full rounded-none" />
                  <View className="absolute left-2 top-2 w-2/3">
                    <SkeletonBlock className="h-6 w-full" />
                  </View>
                </View>
                <View className="gap-2 p-3">
                  <SkeletonBlock className="h-3 w-1/2" />
                  <SkeletonBlock className="h-10 w-full" />
                  <SkeletonBlock className="h-3 w-2/3" />
                  <SkeletonBlock className="h-6 w-3/4" />
                  <SkeletonBlock className="h-3 w-1/2" />
                </View>
              </View>
            ))}
          </View>
        ))}
      </View>
    </Skeleton>
  );
}
