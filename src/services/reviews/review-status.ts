import { z } from 'zod';

export const reviewStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
