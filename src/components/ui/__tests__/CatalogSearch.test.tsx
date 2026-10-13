import { fireEvent, screen } from '@testing-library/react-native';
import { render } from '../../../../tests/support/render-with-toast';
import { addRecentSearch, clearRecentSearches } from '@/hooks/useRecentSearches';
import { productService } from '@/services/products/product-service';
import { productPage } from '../../../../tests/support/product-fixtures';
import { CatalogSearch } from '../CatalogSearch';

jest.mock('expo-image', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return { Image: View };
});

describe('CatalogSearch', () => {
  beforeEach(() => {
    clearRecentSearches();
    jest.clearAllMocks();
  });

  it('renderiza input, botón de filtros y botón X para borrar texto', async () => {
    const onChange = jest.fn();
    const onSubmit = jest.fn();
    const onFilters = jest.fn();

    const view = await render(
      <CatalogSearch value="" onChange={onChange} onSubmit={onSubmit} onFilters={onFilters} />,
    );

    expect(screen.getByLabelText('Buscar equipo ortopédico')).toBeTruthy();
    expect(screen.getByLabelText('Filtrar catálogo')).toBeTruthy();
    expect(screen.getByLabelText('Buscar por voz')).toBeTruthy();
    expect(screen.queryByLabelText('Borrar búsqueda')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Filtrar catálogo'));
    expect(onFilters).toHaveBeenCalledTimes(1);

    await view.rerender(
      <CatalogSearch value="silla" onChange={onChange} onSubmit={onSubmit} onFilters={onFilters} />,
    );

    const clearButton = screen.getByLabelText('Borrar búsqueda');
    expect(clearButton).toBeTruthy();
    expect(screen.queryByLabelText('Buscar por voz')).toBeNull();

    await fireEvent.press(clearButton);
    expect(onChange).toHaveBeenCalledWith('');
    await view.rerender(
      <CatalogSearch value="" onChange={onChange} onSubmit={onSubmit} onFilters={onFilters} />,
    );
    expect(screen.getByLabelText('Buscar por voz')).toBeTruthy();
  });

  it('muestra búsquedas recientes al enfocar con texto vacío y permite seleccionarlas', async () => {
    addRecentSearch('Andador');
    const onChange = jest.fn();
    const onSubmit = jest.fn();

    await render(<CatalogSearch value="" onChange={onChange} onSubmit={onSubmit} />);

    expect(screen.queryByText('Búsquedas recientes')).toBeNull();

    await fireEvent(screen.getByLabelText('Buscar equipo ortopédico'), 'focus');

    expect(await screen.findByText('Búsquedas recientes')).toBeTruthy();
    expect(screen.getByText('Andador')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Buscar Andador'));
    expect(onChange).toHaveBeenCalledWith('Andador');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('Andador');
  });

  it('consulta y muestra productos sugeridos al escribir', async () => {
    jest.spyOn(productService, 'list').mockResolvedValue(productPage(1, 2));
    const onChange = jest.fn();
    const onSubmit = jest.fn();
    const onSelectProduct = jest.fn();

    await render(
      <CatalogSearch
        value="Producto"
        onChange={onChange}
        onSubmit={onSubmit}
        onSelectProduct={onSelectProduct}
      />,
    );

    await fireEvent(screen.getByLabelText('Buscar equipo ortopédico'), 'focus');

    expect(await screen.findByText('Productos sugeridos')).toBeTruthy();
    expect(await screen.findByText('Producto 1')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: /Producto 1/ }));
    expect(onSelectProduct).toHaveBeenCalledWith('1');
  });

  it('notifica onOpenChange cuando el overlay se abre o cierra', async () => {
    addRecentSearch('Muletas');
    const onOpenChange = jest.fn();

    await render(
      <CatalogSearch
        value=""
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        onOpenChange={onOpenChange}
      />,
    );

    expect(onOpenChange).toHaveBeenLastCalledWith(false);

    await fireEvent(screen.getByLabelText('Buscar equipo ortopédico'), 'focus');
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(screen.container.queryAll((node) => node.type.includes('Modal'))).toHaveLength(0);
    expect(screen.container.queryAll((node) => node.type === 'RCTScrollView')).toHaveLength(1);
    const suggestions = screen.getByLabelText('Sugerencias de búsqueda');
    expect(suggestions.props.nestedScrollEnabled).toBe(false);
    await fireEvent(screen.getByLabelText('Buscar equipo ortopédico'), 'blur');
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByText('Búsquedas recientes')).toBeNull();
  });

  it('no muestra avisos de desarrollo al pulsar el micrófono y mantiene la búsqueda escrita', async () => {
    const onSubmit = jest.fn();
    const view = await render(<CatalogSearch value="" onChange={jest.fn()} onSubmit={onSubmit} />);
    await fireEvent.press(screen.getByLabelText('Buscar por voz'));
    expect(screen.queryByText(/Expo Go|versión instalada/)).toBeNull();
    await view.rerender(<CatalogSearch value="silla" onChange={jest.fn()} onSubmit={onSubmit} />);
    await fireEvent(screen.getByLabelText('Buscar equipo ortopédico'), 'submitEditing');
    expect(onSubmit).toHaveBeenCalledWith('silla');
  });

  it('aísla los gestos de sugerencias sin bloquear la pantalla al abrir el panel', async () => {
    addRecentSearch('Muletas');
    const onInteraction = jest.fn();
    await render(
      <CatalogSearch
        value=""
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        onSuggestionsInteractionChange={onInteraction}
      />,
    );
    await fireEvent(screen.getByLabelText('Buscar equipo ortopédico'), 'focus');
    expect(onInteraction).toHaveBeenLastCalledWith(false);
    const suggestions = screen.getByLabelText('Sugerencias de búsqueda');
    await fireEvent(suggestions, 'scrollBeginDrag');
    expect(onInteraction).toHaveBeenLastCalledWith(true);
    await fireEvent(suggestions, 'touchEnd');
    expect(onInteraction).toHaveBeenLastCalledWith(true);
    await fireEvent(suggestions, 'touchCancel');
    expect(onInteraction).toHaveBeenLastCalledWith(true);
    await fireEvent(screen.getByLabelText('Buscar equipo ortopédico'), 'blur');
    expect(screen.getByText('Búsquedas recientes')).toBeTruthy();
    await fireEvent(suggestions, 'scrollEndDrag');
    expect(onInteraction).toHaveBeenLastCalledWith(false);
    await fireEvent(suggestions, 'momentumScrollBegin');
    expect(onInteraction).toHaveBeenLastCalledWith(true);
    await fireEvent(suggestions, 'momentumScrollEnd');
    expect(onInteraction).toHaveBeenLastCalledWith(false);
  });

  it('permite buscar en todo el catálogo cuando fallan las sugerencias', async () => {
    jest.spyOn(productService, 'list').mockRejectedValue(new Error('Sin red'));
    const onSubmit = jest.fn();
    await render(<CatalogSearch value="silla" onChange={jest.fn()} onSubmit={onSubmit} />);
    await fireEvent(screen.getByLabelText('Buscar equipo ortopédico'), 'focus');
    expect(await screen.findByText(/No pudimos cargar las sugerencias/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Buscar silla en el catálogo'));
    expect(onSubmit).toHaveBeenCalledWith('silla');
  });
});
