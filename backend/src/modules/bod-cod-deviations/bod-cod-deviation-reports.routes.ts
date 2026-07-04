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
  '/:id',
  authorize('bod_cod_errors:view'),
  bodCodDeviationReportsController.getReportById,
);
bodCodDeviationReportsRoutes.post(
  '/',
  authorize('bod_cod_errors:edit'),
  bodCodDeviationReportsController.createReport,
);
bodCodDeviationReportsRoutes.get(
  '/',
  authorize('bod_cod_errors:view'),
  bodCodDeviationReportsController.listReports,
);
