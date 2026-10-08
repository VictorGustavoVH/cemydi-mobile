import { homeBanners, homeCategories } from '@/data/catalog-preview';
import {
  emptyProductFilters,
  HOME_PRODUCT_LIMIT,
  productService,
} from '@/services/products/product-service';
import { toProductCard } from '@/services/products/product-adapter';
import type { HomeService } from './homeService';

export const homeService: HomeService = {
  async getHome(signal) {
    const result = await productService.list(emptyProductFilters, 1, HOME_PRODUCT_LIMIT, signal);
    return {
      banners: homeBanners,
      categories: homeCategories,
      products: result.products
        .slice(0, HOME_PRODUCT_LIMIT)
        .map((product) => toProductCard(product)),
    };
  },
};
