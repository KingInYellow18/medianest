import { z } from 'zod';

export const updateMonitorVisibilitySchema = z.object({
  body: z.object({
    isPublic: z.boolean({
      required_error: 'isPublic is required',
      invalid_type_error: 'isPublic must be a boolean',
    }),
  }),
  params: z.object({
    id: z.string().transform((val) => {
      const num = parseInt(val, 10);
      if (isNaN(num)) {
        throw new Error('Monitor ID must be a number');
      }
      return num;
    }),
  }),
});

export const bulkUpdateMonitorVisibilitySchema = z.object({
  body: z.object({
    monitorIds: z
      .array(
        z.number({
          required_error: 'Monitor ID is required',
          invalid_type_error: 'Monitor ID must be a number',
        }),
      )
      .min(1, 'At least one monitor ID is required')
      .max(100, 'Cannot update more than 100 monitors at once'),
    isPublic: z.boolean({
      required_error: 'isPublic is required',
      invalid_type_error: 'isPublic must be a boolean',
    }),
  }),
});

export const resetAllVisibilitySchema = z.object({
  body: z.object({
    confirm: z.literal(true, {
      errorMap: () => ({ message: 'Confirmation is required to reset all monitors' }),
    }),
  }),
});

export type UpdateMonitorVisibilityInput = z.infer<typeof updateMonitorVisibilitySchema>;
export type BulkUpdateMonitorVisibilityInput = z.infer<typeof bulkUpdateMonitorVisibilitySchema>;
export type ResetAllVisibilityInput = z.infer<typeof resetAllVisibilitySchema>;
