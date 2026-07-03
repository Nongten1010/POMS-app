import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/authenticate';
import { authorize } from '../../shared/middlewares/authorize';
import { bodCodDeviationReportsController } from './bod-cod-deviation-reports.controller';

export const bodCodDeviationReportsRoutes = Router();

bodCodDeviationReportsRoutes.use(authenticate);

bodCodDeviationReportsRoutes.get(
  '/factories',
  authorize('bod_cod_errors:view'),
  bodCodDeviationReportsController.listFactories,
);
bodCodDeviationReportsRoutes.get(
  '/',
  authorize('bod_cod_errors:view'),
  bodCodDeviationReportsController.listReports,
);
