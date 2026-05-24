import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { loginSchema } from './auth.validator';
import { authService } from './auth.service';

export const authController = {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = loginSchema.parse(req.body);
      const result = await authService.login(payload);
      res.status(StatusCodes.OK).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  /** ดู profile + scopes ของตัวเอง */
  me(req: Request, res: Response): void {
    res.json({
      success: true,
      data: {
        id: req.user?.id,
        userType: req.user?.userType,
        roles: req.user?.roles,
        scopes: req.user?.scopes,
        permissions: Object.keys(req.user?.scopes ?? {}),
      },
    });
  },
};
