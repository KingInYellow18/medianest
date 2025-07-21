import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Setup MSW server with all handlers
export const server = setupServer(...handlers);

// Import and re-export MSW utilities
import { rest } from 'msw';
export { rest };
