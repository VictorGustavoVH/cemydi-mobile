import type { Product, ProductList } from '@/services/products/product-schemas';

export function productFixture(id = 1, changes: Partial<Product> = {}): Product {
  return {
    id,
    slug: `producto-${id}`,
    nombre: `Producto ${id}`,
    marca: 'Marca de prueba',
    modelo: 'Modelo de prueba',
    descripcion: 'Descripción confirmada del equipo.',
    clasificacion: 'Movilidad',
    precio: 1200,
    stock: 3,
    activo: true,
    tipoAdquisicion: 'MIXTO',
    requiereReceta: false,
    rentalDailyPrice: 60,
    rentalMinDays: 3,
    rentalDeposit: 300,
    rentalTerms: 'Condiciones de renta.',
    medidas: null,
    pesoSoportado: null,
    material: null,
    contenidoCaja: null,
    indicacionesUso: null,
    imageUrl: `https://example.com/product-${id}.jpg`,
    images: [
      {
        id,
        imageUrl: `https://example.com/product-${id}.jpg`,
        sortOrder: 0,
        createdAt: '2026-10-08T12:00:00.000Z',
      },
    ],
    createdAt: '2026-10-08T12:00:00.000Z',
    ...changes,
  };
}

export function productPage(page = 1, total = 26, pageSize = 24): ProductList {
  return {
    products: Array.from(
      { length: Math.max(0, Math.min(pageSize, total - (page - 1) * pageSize)) },
      (_, index) => productFixture((page - 1) * pageSize + index + 1),
    ),
    filters: { clasificaciones: ['Movilidad', 'Soportes'], marcas: ['Marca de prueba'] },
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      hasPrevious: page > 1,
      hasNext: page * pageSize < total,
    },
  };
}
