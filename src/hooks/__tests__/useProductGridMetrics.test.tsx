import type { ReactNode } from 'react';
import { Dimensions, type LayoutChangeEvent } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useProductGridMetrics } from '../useProductGridMetrics';

const wrapper = ({ children }: { children: ReactNode }) => (
  <SafeAreaInsetsContext.Provider value={{ top: 44, bottom: 34, left: 24, right: 24 }}>
    {children}
  </SafeAreaInsetsContext.Provider>
);
const initialWindow = Dimensions.get('window');
const initialScreen = Dimensions.get('screen');
afterEach(() => Dimensions.set({ window: initialWindow, screen: initialScreen }));

it('descuenta insets y gutters, y usa la medida real de un contenedor más estrecho', async () => {
  Dimensions.set({ window: { width: 430, height: 844, fontScale: 1, scale: 3 } });
  const { result } = await renderHook(useProductGridMetrics, { wrapper });
  expect(result.current.columns).toBe(2);
  expect(result.current.itemWidth).toBe((430 - 48 - 40 - 12) / 2);
  await act(() =>
    result.current.onLayout({
      nativeEvent: { layout: { width: 320, height: 800, x: 0, y: 0 } },
    } as LayoutChangeEvent),
  );
  expect(result.current.columns).toBe(1);
  expect(result.current.itemWidth).toBe(280);
  expect(result.current.itemMargin).toBe(20);
});

it('adapta columnas y descarta medidas de la orientación anterior al aumentar la fuente', async () => {
  Dimensions.set({ window: { width: 430, height: 844, fontScale: 1, scale: 3 } });
  const { result } = await renderHook(useProductGridMetrics, { wrapper });
  await act(() =>
    result.current.onLayout({
      nativeEvent: { layout: { width: 382, height: 800, x: 0, y: 0 } },
    } as LayoutChangeEvent),
  );
  await act(() => Dimensions.set({ window: { width: 844, height: 430, fontScale: 2, scale: 3 } }));
  expect(result.current.columns).toBe(1);
  expect(result.current.itemWidth).toBe(844 - 48 - 40);
});
