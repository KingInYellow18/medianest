import type { Request, Response, NextFunction } from 'express';

/**
 * Async Handler Utility - Wraps async route handlers for error handling
 *
 * @function asyncHandler
 * @description Higher-order function that wraps async Express route handlers to automatically catch errors and pass them to error middleware
 * @template T - The return type of the wrapped async function
 * @param {Function} fn - Async route handler function to wrap
 * @returns {Function} Wrapped route handler that catches errors
 *
 * @example
 * // Wrap an async route handler
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await userService.getAll();
 *   res.json(users);
 * }));
 *
 * @example
 * // The wrapper catches errors automatically
 * router.post('/users', asyncHandler(async (req, res) => {
 *   const user = await userService.create(req.body); // If this throws, error is caught
 *   res.status(201).json(user);
 * }));
 *
 * @benefits
 * - Eliminates need for try-catch blocks in route handlers
 * - Ensures all async errors are properly handled by Express error middleware
 * - Maintains promise chain for testing and debugging
 * - Type-safe with TypeScript generics
 *
 * @security Prevents unhandled promise rejections from crashing the application
 * @version 2.0.0
 * @author MediaNest Team
 */
export const asyncHandler = <T = any>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>,
) => {
  return (req: Request, res: Response, next: NextFunction): Promise<T | void> => {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };
};
