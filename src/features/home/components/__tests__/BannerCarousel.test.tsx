import { screen } from '@testing-library/react-native';
import { homeBanners } from '@/data/catalog-preview';
import { render } from '../../../../../tests/support/render-with-toast';
import { BannerCarousel } from '../BannerCarousel';

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) =>
    jest.requireActual('react').useEffect(callback, [callback]),
}));

describe('BannerCarousel', () => {
  it('reserva la altura de la cabecera antes de medirla', async () => {
    await render(<BannerCarousel banners={homeBanners} onExplore={jest.fn()} />);

    // Sin `onLayout`: si las diapositivas esperan una medición, la cabecera de
    // Home crece después del montaje y `maintainVisibleContentPosition` empuja
    // la lista fuera del tope.
    expect(screen.getByText(homeBanners[0].title)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Explorar catálogo' })).toBeTruthy();
  });
});
