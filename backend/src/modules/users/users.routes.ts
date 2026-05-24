import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/authenticate';
import { authorize } from '../../shared/middlewares/authorize';
import { usersController } from './users.controller';

export const usersRoutes = Router();

usersRoutes.use(authenticate);

usersRoutes.get('/', authorize('users:view', 'permissions:manage'), usersController.list);
usersRoutes.get(
  '/:id/permissions',
  authorize('permissions:manage'),
  usersController.getPermissions,
);
usersRoutes.put(
  '/:id/permissions',
  authorize('permissions:manage'),
  usersController.replacePermissions,
);
usersRoutes.get('/:id', authorize('users:view', 'permissions:manage'), usersController.getById);
usersRoutes.post('/', authorize('users:edit', 'permissions:manage'), usersController.create);
usersRoutes.patch('/:id', authorize('users:edit', 'permissions:manage'), usersController.update);
usersRoutes.delete('/:id', authorize('users:edit', 'permissions:manage'), usersController.remove);
