import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/authenticate';
import { authorize } from '../../shared/middlewares/authorize';
import { parameterValuesController } from './parameter-values.controller';

export const parameterValuesRoutes = Router();

parameterValuesRoutes.use(authenticate);

parameterValuesRoutes.get(
  '/connection-test',
  authorize('cems_wpms_requests:view', 'cems_wpms_requests:approve'),
  parameterValuesController.connectionTest,
);

parameterValuesRoutes.use(authorize('cems_wpms_requests:view'));

parameterValuesRoutes.get('/tables', parameterValuesController.listTables);
parameterValuesRoutes.get('/latest', parameterValuesController.latest);
parameterValuesRoutes.get('/', parameterValuesController.list);
