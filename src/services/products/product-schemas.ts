import { z } from 'zod';

// Verified against ProductsService.mapProduct and the Prisma Product model.
export const productSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string(),
  nombre: z.string(),
  marca: z.string(),
  modelo: z.string(),
  descripcion: z.string(),
  clasificacion: z.string(),
  precio: z.number().nonnegative(),
  stock: z.number().int(),
  activo: z.boolean(),
  tipoAdquisicion: z.enum(['VENTA', 'RENTA', 'MIXTO']),
  requiereReceta: z.boolean(),
  rentalDailyPrice: z.number().nullable(),
  rentalMinDays: z.number().int().positive(),
  rentalDeposit: z.number().nonnegative(),
  rentalTerms: z.string().nullable(),
  medidas: z.string().nullable(),
  pesoSoportado: z.string().nullable(),
  material: z.string().nullable(),
  contenidoCaja: z.string().nullable(),
  indicacionesUso: z.string().nullable(),
  imageUrl: z.string().nullable(),
  images: z.array(
    z.object({
      id: z.number().int(),
      imageUrl: z.string(),
      sortOrder: z.number().int(),
      createdAt: z.string(),
    }),
  ),
  createdAt: z.string(),
});

export const productListSchema = z.object({
  products: z.array(productSchema),
  filters: z.object({ clasificaciones: z.array(z.string()), marcas: z.array(z.string()) }),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().positive(),
    hasPrevious: z.boolean(),
    hasNext: z.boolean(),
  }),
});

export const productDetailSchema = z.object({ product: productSchema });
export const productRecommendationsSchema = z.object({
  recommendations: z.array(productSchema),
});
export const productReviewsSchema = z.object({
  reviews: z.array(
    z.object({
      id: z.number().int(),
      rating: z.number().int().min(1).max(5),
      comment: z.string(),
      createdAt: z.string(),
      user: z.object({ id: z.number().int(), nombre: z.string() }),
    }),
  ),
  summary: z.object({
    count: z.number().int().nonnegative(),
    averageRating: z.number().min(0).max(5),
  }),
});
export type ProductReviews = z.infer<typeof productReviewsSchema>;
export const promotionsSchema = z.object({
  promotions: z.array(
    z.object({
      id: z.number().int(),
      productId: z.number().int(),
      discountPercent: z.number().min(0).max(100),
      discountedPrice: z.number().nonnegative(),
      startAt: z.string().datetime(),
      endAt: z.string().datetime(),
    }),
  ),
});

export type Product = z.infer<typeof productSchema>;
export type ProductList = z.infer<typeof productListSchema>;
export type ProductOffer = z.infer<typeof promotionsSchema>['promotions'][number];
