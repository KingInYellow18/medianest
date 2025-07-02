import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'
import { ZodError } from 'zod'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public details?: any
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Log error details
  logger.error({
    timestamp: new Date().toISOString(),
    userId: (req as any).user?.id,
    endpoint: req.path,
    method: req.method,
    error: {
      message: err.message,
      stack: err.stack,
      code: err instanceof AppError ? err.code : undefined,
      details: err instanceof AppError ? err.details : undefined,
    },
    request: {
      headers: req.headers,
      body: req.body,
      query: req.query,
      params: req.params,
    },
  })

  // Handle specific error types
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.errors,
      },
    })
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code || 'ERROR',
        message: err.message,
        details: err.details,
      },
    })
  }

  // Generic error response
  const isDev = process.env.NODE_ENV === 'development'
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: isDev ? err.message : 'Something went wrong. Please try again.',
      stack: isDev ? err.stack : undefined,
    },
  })
}