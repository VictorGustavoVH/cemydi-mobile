import { homeBanners, homeCategories, homeProducts } from '@/data/catalog-preview';

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
