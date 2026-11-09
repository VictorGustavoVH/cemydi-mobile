import type { ImageSourcePropType } from 'react-native';

// Modelos de presentación y contenido editorial; no son contratos de la API.
export type CatalogMode = 'all' | 'purchase' | 'rental';
export type HomeCategory = { id: string; label: string; image: ImageSourcePropType | undefined };
export type HomeProduct = {
  id: string;
  name: string;
  categoryId: string;
  image: ImageSourcePropType | undefined;
  /** Optional presentation metadata; never a presumed backend DTO field. */
  imageBlurhash?: string;
  modes: Exclude<CatalogMode, 'all'>[];
  caption: string;
  rating?: number;
  reviewCount?: number;
  price: string;
  priceSuffix?: string;
  priceNote?: string;
  originalPrice?: string;
  discountPercent?: number;
  unavailable?: boolean;
  prescription?: boolean;
};
export type HomeBanner = {
  id: string;
  title: string;
  description: string;
  image: ImageSourcePropType;
};

const wheelchair = require('../../assets/images/catalog/wheelchair.webp');
const hospitalBed = require('../../assets/images/catalog/hospital-bed.webp');
const kneeBrace = require('../../assets/images/catalog/knee-brace.webp');
const walker = require('../../assets/images/catalog/walker.webp');

export const homeCategories: HomeCategory[] = [
  { id: 'mobility', label: 'Movilidad', image: wheelchair },
  { id: 'rest', label: 'Descanso', image: hospitalBed },
  { id: 'supports', label: 'Soportes', image: kneeBrace },
  { id: 'assistance', label: 'Apoyo', image: walker },
];

export const homeBanners: HomeBanner[] = [
  {
    id: 'freedom',
    title: 'Más libertad.\nMás movimiento.',
    description: 'Equipo para tu día a día.',
    image: wheelchair,
  },
  {
    id: 'rest',
    title: 'Descansa mejor.\nSiéntete mejor.',
    description: 'Cuidado y comodidad en casa.',
    image: hospitalBed,
  },
  {
    id: 'support',
    title: 'Apoyo en\ncada paso.',
    description: 'Encuentra tu próximo aliado.',
    image: walker,
  },
];

export const catalogModes: { value: CatalogMode; label: string }[] = [
  { value: 'all', label: 'Todo' },
  { value: 'purchase', label: 'Compra' },
  { value: 'rental', label: 'Renta' },
];
