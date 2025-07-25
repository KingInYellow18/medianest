import { z } from 'zod';

// Secure URL validator that rejects dangerous protocols
export const secureUrlSchema = z
  .string()
  .url('Invalid URL format')
  .refine(
    (url) => {
      // List of dangerous protocols that should be rejected
      const dangerousProtocols = [
        'javascript:',
        'data:',
        'vbscript:',
        'file:',
        'about:',
        'chrome:',
        'chrome-extension:',
      ];

      const lowerUrl = url.toLowerCase();
      return !dangerousProtocols.some((protocol) => lowerUrl.startsWith(protocol));
    },
    { message: 'URL contains potentially dangerous protocol' },
  )
  .refine(
    (url) => {
      // Only allow http, https, and ftp protocols
      const allowedProtocols = ['http://', 'https://', 'ftp://'];
      const lowerUrl = url.toLowerCase();
      return allowedProtocols.some((protocol) => lowerUrl.startsWith(protocol));
    },
    { message: 'URL must use http, https, or ftp protocol' },
  );

// Common validation schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const uuidParam = z.object({
  id: z.string().uuid('Invalid ID format'),
});

export const dateRangeSchema = z
  .object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.startDate <= data.endDate;
      }
      return true;
    },
    { message: 'Start date must be before end date' },
  );
