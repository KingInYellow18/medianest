import { Router } from 'express';
import { z } from 'zod';

// Mock auth router for testing
export const authRouter = Router();

// PIN generation endpoint
authRouter.post('/plex/pin', async (_req, res, next) => {
  try {
    // This would normally call Plex API
    res.json({
      success: true,
      data: {
        id: '12345',
        code: 'ABCD',
        qrUrl: 'https://plex.tv/link',
        expiresIn: 900,
      },
    });
  } catch (error) {
    next(error);
  }
});

// PIN verification endpoint
const verifySchema = z.object({
  pinId: z.string(),
  rememberMe: z.boolean().optional(),
});

authRouter.post('/plex/verify', async (req, res, next) => {
  try {
    const { pinId } = verifySchema.parse(req.body);

    // This would normally verify PIN and create/update user
    res.json({
      success: true,
      data: {
        user: {
          id: 'user-id',
          username: 'testuser',
          email: 'test@example.com',
          role: 'user',
        },
        token: 'jwt-token',
        rememberToken: 'remember-token',
      },
    });
  } catch (error) {
    next(error);
  }
});
