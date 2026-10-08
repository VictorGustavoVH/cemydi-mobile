import type { CatalogMode, HomeProduct } from '@/data/catalog-preview';
import type { ProductDetailPreview } from '@/data/product-detail-preview';
import type { Product, ProductOffer } from './product-schemas';

const moneyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 2,
});
export const formatProductMoney = (value: number) => moneyFormatter.format(value);

export function getProductOffer(product: Pick<Product, 'id' | 'stock'>, offers: ProductOffer[]) {
  const now = Date.now();
  return offers
    .filter(
      (offer) =>
        offer.productId === product.id &&
        product.stock > 0 &&
        Date.parse(offer.startAt) <= now &&
        Date.parse(offer.endAt) >= now,
    )
    .reduce<ProductOffer | undefined>(
      (best, offer) => (!best || offer.discountedPrice < best.discountedPrice ? offer : best),
      undefined,
    );
}

export function withProductOffer(product: HomeProduct, offers: ProductOffer[] = []): HomeProduct {
  if (product.unavailable || !product.modes.includes('purchase')) return product;
  const offer = getProductOffer({ id: Number(product.id), stock: 1 }, offers);
  return offer
    ? {
        ...product,
        originalPrice: product.price,
        price: formatProductMoney(offer.discountedPrice),
        discountPercent: offer.discountPercent,
      }
    : product;
}

export function toProductCard(
  product: Product,
  offers: ProductOffer[] = [],
  mode: CatalogMode = 'all',
): HomeProduct {
  const modes: HomeProduct['modes'] =
    product.tipoAdquisicion === 'MIXTO'
      ? ['purchase', 'rental']
      : product.tipoAdquisicion === 'RENTA'
        ? ['rental']
        : ['purchase'];
  const rental = mode === 'rental' || product.tipoAdquisicion === 'RENTA';
  // Public promotions discount precio; they do not define a discounted rentalDailyPrice.
  const offer = rental ? undefined : getProductOffer(product, offers);
  const price = rental ? product.rentalDailyPrice : (offer?.discountedPrice ?? product.precio);
  return {
    id: String(product.id),
    name: product.nombre,
    categoryId: product.clasificacion,
    image: product.imageUrl ? { uri: product.imageUrl } : undefined,
    modes,
    caption: product.marca,
    price: price === null ? 'Consultar tarifa' : formatProductMoney(price),
    priceSuffix: rental ? '/ día' : undefined,
    priceNote: modes.length > 1 ? 'Compra y renta' : rental ? 'Renta diaria' : 'Compra',
    originalPrice: offer ? formatProductMoney(product.precio) : undefined,
    discountPercent: offer?.discountPercent,
    unavailable: product.stock <= 0,
    prescription: product.requiereReceta,
  };
}

export function toProductDetail(
  product: Product,
  offers: ProductOffer[] = [],
): ProductDetailPreview {
  const card = toProductCard(product, offers, 'purchase');
  return {
    ...card,
    // Detail keeps the purchase amount independently from the selected rental mode.
    price: formatProductMoney(getProductOffer(product, offers)?.discountedPrice ?? product.precio),
    category: product.clasificacion,
    description: product.descripcion,
    images: product.images.map((image) => ({
      id: String(image.id),
      source: { uri: image.imageUrl },
    })),
    characteristics: [
      { label: 'Marca', value: product.marca },
      { label: 'Modelo', value: product.modelo },
      { label: 'Medidas', value: product.medidas },
      { label: 'Peso soportado', value: product.pesoSoportado },
      { label: 'Material', value: product.material },
      { label: 'Contenido de la caja', value: product.contenidoCaja },
      { label: 'Indicaciones de uso', value: product.indicacionesUso },
    ].filter((item): item is { label: string; value: string } => Boolean(item.value)),
    prescription: product.requiereReceta,
    rental:
      product.tipoAdquisicion !== 'VENTA' && product.rentalDailyPrice !== null
        ? {
            price: formatProductMoney(product.rentalDailyPrice),
            minimum: `${product.rentalMinDays} ${product.rentalMinDays === 1 ? 'día' : 'días'}`,
            deposit: formatProductMoney(product.rentalDeposit),
            terms: product.rentalTerms ?? '',
          }
        : undefined,
  };
}
