import type { ImageSourcePropType } from 'react-native';

// Presentation fixtures only: these are not API contracts or real prices.
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

export const homeProducts: HomeProduct[] = [
  {
    id: 'bed',
    name: 'Cama hospitalaria',
    categoryId: 'rest',
    image: hospitalBed,
    modes: ['rental'],
    caption: 'Renta diaria',
    price: '$80',
    priceSuffix: '/ día',
  },
  {
    id: 'wheelchair',
    name: 'Silla de ruedas',
    categoryId: 'mobility',
    image: wheelchair,
    modes: ['purchase', 'rental'],
    caption: 'Compra o renta',
    price: '$3,850',
    priceNote: 'Precio de compra',
  },
  {
    id: 'brace',
    name: 'Rodillera ajustable',
    categoryId: 'supports',
    image: kneeBrace,
    modes: ['purchase'],
    caption: 'Compra',
    price: '$650',
  },
  {
    id: 'walker',
    name: 'Andadera plegable',
    categoryId: 'assistance',
    image: walker,
    modes: ['purchase', 'rental'],
    caption: 'Compra o renta',
    price: '$1,250',
    priceNote: 'Precio de compra',
  },
  {
    id: 'boot',
    name: 'Bota ortopédica',
    categoryId: 'supports',
    image: require('../../assets/images/catalog/walker-boot.webp'),
    modes: ['purchase'],
    caption: 'Compra',
    price: '$1,450',
  },
  {
    id: 'oxygen',
    name: 'Concentrador de oxígeno',
    categoryId: 'rest',
    image: require('../../assets/images/catalog/oxygen-concentrator.webp'),
    modes: ['rental'],
    caption: 'Renta diaria',
    price: '$120',
    priceSuffix: '/ día',
  },
  {
    id: 'crutches',
    name: 'Muletas ajustables',
    categoryId: 'mobility',
    image: require('../../assets/images/catalog/crutches.webp'),
    modes: ['purchase'],
    caption: 'Compra',
    price: '$780',
  },
];
