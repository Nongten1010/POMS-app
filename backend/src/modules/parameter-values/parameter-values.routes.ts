import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/authenticate';
import { authorize } from '../../shared/middlewares/authorize';
import { parameterValuesController } from './parameter-values.controller';

export const parameterValuesRoutes = Router();

parameterValuesRoutes.use(authenticate, authorize('cems_wpms_requests:view'));

parameterValuesRoutes.get('/tables', parameterValuesController.listTables);
parameterValuesRoutes.get('/connection-test', parameterValuesController.connectionTest);
parameterValuesRoutes.get('/latest', parameterValuesController.latest);
parameterValuesRoutes.get('/', parameterValuesController.list);
