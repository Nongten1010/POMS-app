import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  createManagedUserSchema,
  listManagedUsersQuerySchema,
  updateManagedUserSchema,
  replaceUserPermissionsSchema,
  userIdParamSchema,
} from './users.validator';
import { usersService } from './users.service';

export const usersController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listManagedUsersQuerySchema.parse(req.query);
      const result = await usersService.list(query);
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = userIdParamSchema.parse(req.params);
      const data = await usersService.getById(id);
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = req.user?.id;
      if (!actorUserId) throw new Error('Authenticated user missing from request');
      const payload = createManagedUserSchema.parse(req.body);
      const data = await usersService.create(payload, actorUserId);
      res.status(StatusCodes.CREATED).location(`${req.baseUrl}/${data.id}`).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = req.user?.id;
      if (!actorUserId) throw new Error('Authenticated user missing from request');
      const { id } = userIdParamSchema.parse(req.params);
      const payload = updateManagedUserSchema.parse(req.body);
      const data = await usersService.update(id, payload, actorUserId);
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = req.user?.id;
      if (!actorUserId) throw new Error('Authenticated user missing from request');
      const { id } = userIdParamSchema.parse(req.params);
      await usersService.delete(id, actorUserId);
      res.status(StatusCodes.NO_CONTENT).send();
    } catch (err) {
      next(err);
    }
  },

  async getPermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = userIdParamSchema.parse(req.params);
      const data = await usersService.getPermissions(id);
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async replacePermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = req.user?.id;
      if (!actorUserId) throw new Error('Authenticated user missing from request');
      const { id } = userIdParamSchema.parse(req.params);
      const payload = replaceUserPermissionsSchema.parse(req.body);
      const data = await usersService.replacePermissions(id, payload, actorUserId);
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
