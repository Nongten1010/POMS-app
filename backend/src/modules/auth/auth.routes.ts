import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { StatusCodes } from 'http-status-codes';
import { authController } from './auth.controller';
import { authenticate } from '../../shared/middlewares/authenticate';

export const authRoutes = Router();

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(StatusCodes.TOO_MANY_REQUESTS).json({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many login attempts. Please try again later.',
      },
    });
  },
});

authRoutes.post('/login', loginRateLimiter, authController.login);
authRoutes.get('/me', authenticate, authController.me);
