import { setupServer } from 'msw/node';
import { beforeAll, afterEach, afterAll } from 'vitest';

import { handlers } from './handlers';
import { handlers as mockHandlers } from '../mocks/handlers';

// Combine both handler sets - MSW handlers take precedence
export const server = setupServer(...handlers, ...mockHandlers);

// Export server and http for use in individual tests if needed
export { http, HttpResponse } from 'msw';
