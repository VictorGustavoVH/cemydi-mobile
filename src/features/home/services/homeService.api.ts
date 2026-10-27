import { homeBanners, homeCategories } from '@/data/catalog-preview';
import { emptyProductFilters, HOME_PRODUCT_LIMIT } from '@/services/products/product-service';
import { toProductCard } from '@/services/products/product-adapter';
import { productRepository } from '@/services/products/product-repository';
import type { HomeService } from './homeService';

export const homeService: HomeService = {
  async getHome(signal) {
    const result = await productRepository.list(emptyProductFilters, 1, HOME_PRODUCT_LIMIT, signal);
    const products = result.products.slice(0, HOME_PRODUCT_LIMIT);
    return {
      banners: homeBanners,
      categories: homeCategories,
      products: products.map((product) => toProductCard(product)),
      // Mismo producto, sin adaptar: el detalle lo reutiliza como dato propio.
      rawProducts: products,
    };
  },
};
