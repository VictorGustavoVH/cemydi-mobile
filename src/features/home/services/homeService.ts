import type { HomeBanner, HomeCategory, HomeProduct } from '@/data/catalog-preview';

export type HomeData = {
  banners: HomeBanner[];
  categories: HomeCategory[];
  products: HomeProduct[];
};

/**
 * Contrato del servicio de Home.
 *
 * Productos públicos reales; banners y categorías editoriales siguen siendo locales.
 * homeService.mock queda reservado para pruebas y vistas de muestra.
 */
export interface HomeService {
  getHome(signal?: AbortSignal): Promise<HomeData>;
}
