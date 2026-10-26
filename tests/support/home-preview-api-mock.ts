import { homeService } from '@/features/home/services/homeService.api';
import { homeServiceMock } from '@/features/home/services/homeService.mock';
import { productService } from '@/services/products/product-service';

// Explicit compatibility fixtures for tests of the isolated preview cart/auth flows.
export function installHomePreviewApiMock() {
  jest.spyOn(homeService, 'getHome').mockImplementation(() => homeServiceMock.getHome());
  jest.spyOn(productService, 'offers').mockResolvedValue({ promotions: [] });
}
