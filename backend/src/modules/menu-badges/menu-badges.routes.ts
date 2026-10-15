import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/authenticate';
import { UnauthorizedError } from '../../shared/errors/AppError';
import { menuBadgesService } from './menu-badges.service';

export const menuBadgesRoutes = Router();

menuBadgesRoutes.get('/menu-badges', authenticate, async (req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const data = await menuBadgesService.get(req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});
