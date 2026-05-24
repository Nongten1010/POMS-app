import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '../../shared/middlewares/authenticate';

export const authRoutes = Router();

authRoutes.post('/login', authController.login);
authRoutes.get('/me', authenticate, authController.me);
