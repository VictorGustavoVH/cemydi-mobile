import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useContainerWidth } from './useContainerWidth';
import { spacing } from '@/theme';

export const PRODUCT_GRID_GUTTER = spacing[5];
export const PRODUCT_GRID_GAP = spacing[3];
const columnWrapperStyle = { gap: PRODUCT_GRID_GAP, paddingHorizontal: PRODUCT_GRID_GUTTER };

export function useProductGridMetrics() {
  const { fontScale } = useWindowDimensions();
  const { width: containerWidth, onLayout } = useContainerWidth();
  const columns = containerWidth < 350 || fontScale > 1.3 ? 1 : 2;
  const itemWidth = Math.max(
    0,
    (containerWidth - PRODUCT_GRID_GUTTER * 2 - (columns - 1) * PRODUCT_GRID_GAP) / columns,
  );
  return useMemo(
    () => ({
      columns,
      itemWidth,
      itemMargin: columns === 1 ? PRODUCT_GRID_GUTTER : 0,
      columnWrapperStyle: columns > 1 ? columnWrapperStyle : undefined,
      onLayout,
    }),
    [columns, itemWidth, onLayout],
  );
}
