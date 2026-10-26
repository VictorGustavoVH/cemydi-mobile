import type { HomeBanner, HomeCategory, HomeProduct } from '@/data/catalog-preview';
import type { Product } from '@/services/products/product-schemas';

export type HomeData = {
  banners: HomeBanner[];
  categories: HomeCategory[];
  products: HomeProduct[];
  /**
   * Productos crudos de la misma consulta. Inicio los deja listos para el
   * detalle: abrir una ficha desde aquí no monta el skeleton ni reacomoda el
   * contenido al llegar la respuesta. Las fuentes de muestra no los exponen.
   */
  rawProducts?: Product[];
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
