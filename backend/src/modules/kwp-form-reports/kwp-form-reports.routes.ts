import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/authenticate';
import { authorize } from '../../shared/middlewares/authorize';
import { kwpFormReportsController } from './kwp-form-reports.controller';

export const kwpFormReportsRoutes = Router();

kwpFormReportsRoutes.use(authenticate);

kwpFormReportsRoutes.get(
  '/factories',
  authorize('kwp_forms:view'),
  kwpFormReportsController.listFactories,
);
kwpFormReportsRoutes.get(
  '/requests',
  authorize('kwp_forms:view'),
  kwpFormReportsController.listRequests,
);
