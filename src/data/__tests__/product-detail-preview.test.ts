import {
  getProductPreview,
  getRecommendationsPreview,
  productDetails,
} from '../product-detail-preview';

describe('Selección de productos de muestra', () => {
  it('recupera un producto por ID y devuelve undefined si no existe', () => {
    expect(getProductPreview('wheelchair')?.name).toBe('Silla de ruedas');
    expect(getProductPreview('missing')).toBeUndefined();
  });

  it('prioriza la misma categoría, excluye el producto actual y no altera los fixtures', () => {
    const product = getProductPreview('wheelchair')!;
    const originalIds = productDetails.map(({ id }) => id);
    const recommendations = getRecommendationsPreview(product);
    expect(recommendations).toHaveLength(4);
    expect(recommendations[0].id).toBe('crutches');
    expect(recommendations.some(({ id }) => id === product.id)).toBe(false);
    expect(new Set(recommendations.map(({ id }) => id)).size).toBe(4);
    expect(productDetails.map(({ id }) => id)).toEqual(originalIds);
  });
});
