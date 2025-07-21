import express, { Express } from 'express';
import { json } from 'body-parser';
import jwt from 'jsonwebtoken';

// Create a test app with basic middleware
export function createTestApp(): Express {
  const app = express();

  // Basic middleware
  app.use(json());

  // Mock auth middleware
  app.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!);
        (req as any).user = decoded;
      } catch (error: any) {
        // Invalid token, log for debugging but continue
        if (error.name !== 'TokenExpiredError' || !req.path.includes('/auth/me')) {
          // Don't log expected errors for auth tests
        }
      }
    }
    next();
  });

  return app;
}

// Helper to create test JWT tokens
export function createTestJWT(payload: any = {}): string {
  return jwt.sign(
    {
      userId: 'test-user-id',
      role: 'user',
      ...payload,
    },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' },
  );
}
