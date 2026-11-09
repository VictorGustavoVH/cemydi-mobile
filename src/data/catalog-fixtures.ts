import type { HomeProduct } from './catalog-preview';

// Solo fixtures y servicio mock. Ninguna ruta o servicio de producción importa este módulo.
const wheelchair = require('../../assets/images/catalog/wheelchair.webp');
const hospitalBed = require('../../assets/images/catalog/hospital-bed.webp');
const kneeBrace = require('../../assets/images/catalog/knee-brace.webp');
const walker = require('../../assets/images/catalog/walker.webp');

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
