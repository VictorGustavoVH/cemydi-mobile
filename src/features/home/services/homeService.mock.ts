import { homeBanners, homeCategories } from '@/data/catalog-preview';
import { homeProducts } from '@/data/catalog-fixtures';

import type { HomeData, HomeService } from './homeService';

export const homeServiceMock: HomeService = {
  async getHome(): Promise<HomeData> {
    return {
      banners: homeBanners,
      categories: homeCategories,
      products: homeProducts,
    };
  },
};
