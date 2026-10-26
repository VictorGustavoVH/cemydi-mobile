import { act, renderHook } from '@testing-library/react-native';
import {
  addRecentSearch,
  clearRecentSearches,
  removeRecentSearch,
  useRecentSearches,
} from '../useRecentSearches';

describe('useRecentSearches', () => {
  beforeEach(() => {
    clearRecentSearches();
  });

  it('inicia vacío y añade búsquedas recientes sin duplicar', async () => {
    const { result } = await renderHook(() => useRecentSearches());
    expect(result.current.searches).toEqual([]);

    await act(async () => {
      result.current.addSearch('Silla de ruedas');
    });
    expect(result.current.searches).toEqual(['Silla de ruedas']);

    await act(async () => {
      result.current.addSearch('Andador');
    });
    expect(result.current.searches).toEqual(['Andador', 'Silla de ruedas']);

    await act(async () => {
      result.current.addSearch('silla de ruedas');
    });
    expect(result.current.searches).toEqual(['silla de ruedas', 'Andador']);
  });

  it('permite eliminar un término individual y limpiar todo el historial', async () => {
    const { result } = await renderHook(() => useRecentSearches());

    await act(async () => {
      addRecentSearch('Muletas');
      addRecentSearch('Férula');
    });
    expect(result.current.searches).toEqual(['Férula', 'Muletas']);

    await act(async () => {
      removeRecentSearch('Muletas');
    });
    expect(result.current.searches).toEqual(['Férula']);

    await act(async () => {
      clearRecentSearches();
    });
    expect(result.current.searches).toEqual([]);
  });

  it('limita el historial a 6 términos', async () => {
    const { result } = await renderHook(() => useRecentSearches());
    for (let i = 1; i <= 8; i++) {
      await act(async () => {
        addRecentSearch(`Término ${i}`);
      });
    }
    expect(result.current.searches).toHaveLength(6);
    expect(result.current.searches[0]).toBe('Término 8');
  });
});
