import { Request, Response, NextFunction } from 'express'
import { metrics } from '../utils/monitoring'

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now()
  
  // Skip logging for health check endpoint
  if (req.path === '/health') {
    return next()
  }

  // Log request start
  req.logger.info('Request started', {
    method: req.method,
    path: req.path,
    query: req.query,
    userId: req.user?.id,
    ip: req.ip,
    userAgent: req.get('user-agent')
  })

  // Capture response
  const originalSend = res.send
  res.send = function(data) {
    res.send = originalSend
    
    const duration = Date.now() - start
    
    req.logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ...(res.statusCode >= 400 && { response: data })
    })
    
    // Record metrics
    metrics.incrementRequest(`${req.method} ${req.path}`)
    metrics.recordDuration(duration)
    
    return res.send(data)
  } as any

  next()
}