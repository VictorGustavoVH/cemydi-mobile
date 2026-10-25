import { fireEvent, render, screen } from '@testing-library/react-native';
import { CatalogImage } from '../CatalogImage';
import { colors } from '@/theme';
import { getLocalImageBlurhash } from '@/data/local-image-placeholders';
import * as Reanimated from 'react-native-reanimated';

jest.mock('expo-image', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return { Image: View };
});

describe('CatalogImage', () => {
  it('muestra un fallback accesible y recupera una celda al cambiar su origen', async () => {
    const view = await render(
      <CatalogImage label="Equipo" source={{ uri: 'https://images.test/a.png' }} />,
    );
    const originalKey = screen.getByLabelText('Equipo').props.recyclingKey;
    await fireEvent(screen.getByLabelText('Equipo'), 'error');
    expect(screen.getByLabelText('Equipo: imagen no disponible')).toBeTruthy();
    await view.rerender(
      <CatalogImage label="Equipo" source={{ uri: 'https://images.test/b.png' }} />,
    );
    expect(screen.queryByText('Imagen no disponible')).toBeNull();
    expect(screen.getByLabelText('Equipo').props.recyclingKey).not.toBe(originalKey);
  });

  it('usa el hash de la imagen remota y un fondo neutro cuando no existe', async () => {
    const source = { uri: 'https://images.test/a.png' };
    const hash = 'LEHV6nWB2yk8pyo0adR*.7kCMdnj';
    const view = await render(<CatalogImage label="Equipo" source={source} blurhash={hash} />);
    expect(screen.getByLabelText('Equipo')).toHaveProp('placeholder', { blurhash: hash });
    expect(screen.getByLabelText('Equipo')).toHaveProp('placeholderContentFit', 'contain');
    await view.rerender(<CatalogImage label="Equipo" source={source} />);
    expect(screen.getByLabelText('Equipo').props.placeholder).toBeUndefined();
    expect(screen.getByLabelText('Equipo')).toHaveStyle({ backgroundColor: colors.surfaceMuted });
    expect(screen.getByLabelText('Equipo')).toHaveProp('cachePolicy', 'memory-disk');
  });

  it('usa un BlurHash precalculado diferente para cada recurso local', async () => {
    const wheelchair = require('../../../../assets/images/catalog/wheelchair.webp');
    const walker = require('../../../../assets/images/catalog/walker.webp');
    const firstHash = getLocalImageBlurhash(wheelchair);
    const secondHash = getLocalImageBlurhash(walker);
    expect(firstHash).toHaveLength(28);
    expect(secondHash).toHaveLength(28);
    expect(firstHash).not.toBe(secondHash);
    const view = await render(<CatalogImage label="Local" source={wheelchair} />);
    expect(screen.getByLabelText('Local')).toHaveProp('placeholder', { blurhash: firstHash });
    expect(screen.getByLabelText('Local')).toHaveProp('transition', 150);
    await view.rerender(<CatalogImage label="Local" source={walker} contentFit="fill" />);
    expect(screen.getByLabelText('Local')).toHaveProp('placeholder', { blurhash: secondHash });
    expect(screen.getByLabelText('Local')).toHaveProp('placeholderContentFit', 'fill');
  });

  it('omite la transición cuando se solicita movimiento reducido', async () => {
    const reducedMotion = jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    await render(
      <CatalogImage
        label="Local"
        source={require('../../../../assets/images/catalog/walker.webp')}
      />,
    );
    expect(screen.getByLabelText('Local')).toHaveProp('transition', 0);
    expect(screen.getByLabelText('Local').props.placeholder).toBeDefined();
    reducedMotion.mockRestore();
  });

  it('no inventa un hash para recursos no registrados', async () => {
    await render(<CatalogImage label="Local" source={42} />);
    expect(screen.getByLabelText('Local').props.placeholder).toBeUndefined();
  });
});
