import { homeService } from '../homeService.api';
import { productRepository } from '@/services/products/product-repository';
import { productFixture, productPage } from '../../../../../tests/support/product-fixtures';
import { homeBanners, homeCategories } from '@/data/catalog-preview';

it('filtra activos antes del límite y conserva banners, categorías e imágenes editoriales', async () => {
  const active = Array.from({ length: 7 }, (_, index) => productFixture(index + 2));
  jest.spyOn(productRepository, 'list').mockResolvedValue({
    ...productPage(1, 8, 8),
    products: [productFixture(1, { activo: false }), ...active],
  });
  const data = await homeService.getHome();
  expect(data.rawProducts?.map((product) => product.id)).toEqual([2, 3, 4, 5, 6, 7]);
  expect(data.products.map((product) => product.id)).toEqual(['2', '3', '4', '5', '6', '7']);
  expect(data.banners).toBe(homeBanners);
  expect(data.categories).toBe(homeCategories);
  expect(data.categories.every((category) => Boolean(category.image))).toBe(true);
});

it('conserva el contenido editorial aunque el servidor solo entregue productos inactivos', async () => {
  jest.spyOn(productRepository, 'list').mockResolvedValue({
    ...productPage(1, 1),
    products: [productFixture(1, { activo: false })],
  });
  const data = await homeService.getHome();
  expect(data.rawProducts).toEqual([]);
  expect(data.products).toEqual([]);
  expect(data.banners).toBe(homeBanners);
  expect(data.categories).toBe(homeCategories);
});
