import type { HomeBanner, HomeCategory, HomeProduct } from '../home-mocks';

export type HomeData = {
  banners: HomeBanner[];
  categories: HomeCategory[];
  products: HomeProduct[];
};

/**
 * Contrato del servicio de Home.
 *
 * Por ahora la app usa homeService.mock. Cuando exista backend, crea
 * homeService.api.ts que implemente esta misma interfaz usando
 * src/services/http/client y cambia la importación en useHome.
 */
export interface HomeService {
  getHome(): Promise<HomeData>;
}
