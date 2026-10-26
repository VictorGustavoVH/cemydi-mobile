import { z } from 'zod';

export const notificationPreferencesSchema = z.object({
  pushEnabled: z.boolean(),
  system: z.boolean(),
  offers: z.boolean(),
  rentals: z.boolean(),
});
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
export const preferencesResponseSchema = z.object({ preferences: notificationPreferencesSchema });
export const notificationSchema = z.object({
  id: z.string(),
  category: z.enum(['SYSTEM', 'OFFER', 'RENTAL']),
  title: z.string(),
  body: z.string(),
  destinationType: z.enum(['NONE', 'PRODUCT', 'PROMOTION', 'RENTAL', 'ACCOUNT']),
  destinationId: z.string().nullable(),
  createdAt: z.string(),
  readAt: z.string().nullable(),
  preview: z
    .object({
      imageUrl: z.string().url().nullable(),
      discountPercent: z.number().min(0).max(100).nullable(),
    })
    .nullish(),
});
export type CustomerNotification = z.infer<typeof notificationSchema>;
export const inboxSchema = z.object({
  items: z.array(notificationSchema),
  unreadCount: z.number().int(),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type NotificationInbox = z.infer<typeof inboxSchema>;
export const notificationDetailSchema = z.object({ item: notificationSchema });
export const notificationPromotionSchema = z.object({
  promotion: z.object({
    id: z.number().int(),
    description: z.string(),
    discountPercent: z.number(),
    endAt: z.string(),
    products: z.array(z.object({ id: z.number().int(), nombre: z.string() })),
  }),
});
