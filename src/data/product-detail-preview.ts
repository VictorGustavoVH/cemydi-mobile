import { homeProducts, type HomeProduct } from './catalog-preview';

export type ProductDetailPreview = HomeProduct & {
  images?: { id: string; source: HomeProduct['image']; blurhash?: string }[];
  category: string;
  description: string;
  characteristics: { label: string; value: string }[];
  rental?: { price: string; minimum: string; deposit: string; terms: string };
  prescription: boolean;
};

// Illustrative presentation content only, never API contracts or real specifications.
const details: Record<
  string,
  Omit<ProductDetailPreview, Exclude<keyof HomeProduct, 'prescription'>>
> = {
  bed: {
    category: 'Descanso y cuidado',
    description:
      'Un espacio cómodo para el cuidado en casa. Explora las características de esta cama hospitalaria y revisa las condiciones antes de elegir tu renta.',
    characteristics: [
      { label: 'Diseño', value: 'Respaldo articulado' },
      { label: 'Apoyos', value: 'Barandales laterales' },
      { label: 'Movilidad', value: 'Base con ruedas' },
    ],
    rental: {
      price: '$80',
      minimum: '7 días',
      deposit: '$1,000',
      terms:
        'Elige las fechas en el carrito. Ahí se confirmarán la disponibilidad, los documentos y las condiciones de entrega.',
    },
    prescription: false,
  },
  wheelchair: {
    category: 'Movilidad',
    description:
      'Acompaña los traslados cotidianos con una silla de ruedas de diseño práctico. Explora sus características y elige entre compra o renta según lo que necesites.',
    characteristics: [
      { label: 'Asiento', value: 'Acolchado' },
      { label: 'Apoyos', value: 'Reposabrazos y reposapiés' },
      { label: 'Estructura', value: 'Metálica' },
    ],
    rental: {
      price: '$45',
      minimum: '3 días',
      deposit: '$500',
      terms:
        'Añade el equipo y configura las fechas en el carrito antes de completar tu solicitud.',
    },
    prescription: false,
  },
  brace: {
    category: 'Soportes',
    description:
      'Soporte de rodilla con correas ajustables para acompañar tu rutina. Consulta con un profesional de salud qué soporte es adecuado para tu caso.',
    characteristics: [
      { label: 'Ajuste', value: 'Correas regulables' },
      { label: 'Diseño', value: 'Abertura frontal' },
      { label: 'Contenido', value: 'Una rodillera' },
    ],
    prescription: false,
  },
  walker: {
    category: 'Apoyo',
    description:
      'Un punto de apoyo para tus desplazamientos. Compara compra y renta y revisa sus características antes de añadirla al carrito.',
    characteristics: [
      { label: 'Estructura', value: 'Metálica' },
      { label: 'Agarre', value: 'Empuñaduras superiores' },
      { label: 'Apoyo', value: 'Cuatro patas' },
    ],
    rental: {
      price: '$25',
      minimum: '3 días',
      deposit: '$300',
      terms: 'Las fechas, la disponibilidad y las condiciones se revisan desde el carrito.',
    },
    prescription: false,
  },
  boot: {
    category: 'Soportes',
    description:
      'Bota ortopédica con cierre ajustable. Revisa el modelo y consulta la talla y las indicaciones con tu profesional de salud antes de elegirla.',
    characteristics: [
      { label: 'Cierre', value: 'Correas ajustables' },
      { label: 'Formato', value: 'Bota alta' },
      { label: 'Contenido', value: 'Una bota ortopédica' },
    ],
    prescription: false,
  },
  oxygen: {
    category: 'Cuidado en casa',
    description:
      'Equipo de apoyo para el cuidado respiratorio en casa. Su uso debe seguir las indicaciones de un profesional de salud; revisa los requisitos antes de solicitarlo.',
    characteristics: [
      { label: 'Formato', value: 'Equipo de piso' },
      { label: 'Movilidad', value: 'Base con ruedas' },
      { label: 'Uso', value: 'Según indicación médica' },
    ],
    rental: {
      price: '$120',
      minimum: '7 días',
      deposit: '$1,500',
      terms: 'Configura las fechas y adjunta la receta en el carrito antes de enviar la solicitud.',
    },
    prescription: true,
  },
  crutches: {
    category: 'Movilidad',
    description:
      'Muletas para acompañar desplazamientos con apoyo. Consulta el ajuste y las indicaciones de uso con tu profesional de salud.',
    characteristics: [
      { label: 'Ajuste', value: 'Altura regulable' },
      { label: 'Apoyos', value: 'Axilares y empuñaduras' },
      { label: 'Contenido', value: 'Un par de muletas' },
    ],
    prescription: false,
  },
};

export const productDetails: ProductDetailPreview[] = homeProducts.map((product) => ({
  ...product,
  ...details[product.id],
}));
export function getProductPreview(id: string) {
  return productDetails.find((product) => product.id === id);
}
export function getRecommendationsPreview(product: ProductDetailPreview) {
  return productDetails
    .filter((item) => item.id !== product.id)
    .sort(
      (a, b) =>
        Number(b.categoryId === product.categoryId) - Number(a.categoryId === product.categoryId),
    )
    .slice(0, 4);
}
