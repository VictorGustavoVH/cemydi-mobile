import { useCallback, useState } from 'react';
import { useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** La medida real prevalece; el primer frame ya descuenta los insets horizontales. */
export function useContainerWidth() {
  const { width: windowWidth } = useWindowDimensions();
  const { left, right } = useSafeAreaInsets();
  const frame = `${windowWidth}:${left}:${right}`;
  const [measured, setMeasured] = useState<{ frame: string; width: number }>();
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const width = event.nativeEvent.layout.width;
      if (width > 0)
        setMeasured((current) =>
          current?.frame === frame && current.width === width ? current : { frame, width },
        );
    },
    [frame],
  );
  return {
    width: measured?.frame === frame ? measured.width : Math.max(0, windowWidth - left - right),
    onLayout,
  };
}
