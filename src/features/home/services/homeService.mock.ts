import { homeBanners, homeCategories, homeProducts } from '../home-mocks';

import type { HomeData, HomeService } from './homeService';

const MOCK_DELAY_MS = 0;

export const homeServiceMock: HomeService = {
  async getHome(): Promise<HomeData> {
    if (MOCK_DELAY_MS > 0) {
      await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));
    }

    return {
      banners: homeBanners,
      categories: homeCategories,
      products: homeProducts,
    };
  },
};
