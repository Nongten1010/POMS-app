import { Router } from 'express';
import multer from 'multer';
import { BadRequestError } from '../../shared/errors/AppError';
import { authenticate } from '../../shared/middlewares/authenticate';
import { authorize } from '../../shared/middlewares/authorize';
import {
  allowedDocumentFileTypes,
  MAX_DOCUMENT_FILE_SIZE_BYTES,
} from './connection-request-document-image.service';
import { connectionRequestsController } from './connection-requests.controller';

export const connectionRequestsRoutes = Router();
export const operatorFactoryDashboardRoutes = Router();
export const operatorFactoryRoutes = Router();
export const publicFactoryMapPointRoutes = Router();
const documentImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_DOCUMENT_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (allowedDocumentFileTypes.has(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(new BadRequestError('Unsupported file type'));
  },
});

connectionRequestsRoutes.use(authenticate);
operatorFactoryDashboardRoutes.use(authenticate);
operatorFactoryRoutes.use(authenticate);

operatorFactoryDashboardRoutes.get(
  '/',
  authorize('dashboard:view'),
  connectionRequestsController.listOperatorFactoryDashboard,
);

publicFactoryMapPointRoutes.get('/', connectionRequestsController.listPublicFactoryMapPoints);

operatorFactoryRoutes.put(
  '/:factoryId/favorite',
  authorize('factories:view'),
  authorize('dashboard.alerts:view'),
  connectionRequestsController.setOperatorFactoryFavorite,
);

connectionRequestsRoutes.get(
  '/',
  authorize('cems_wpms_requests:view'),
  connectionRequestsController.list,
);
connectionRequestsRoutes.get(
  '/table-rows',
  authorize('cems_wpms_requests:view'),
  connectionRequestsController.listTableRows,
);
connectionRequestsRoutes.get(
  '/operator-factories',
  authorize('factories:view'),
  connectionRequestsController.listOperatorFactories,
);
connectionRequestsRoutes.get(
  '/eligible-factories',
  authorize('cems_wpms_requests:view'),
  connectionRequestsController.listOfficerEligibleFactories,
);
connectionRequestsRoutes.get('/operator-factory-dashboard', (_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Use GET /api/v1/operator-factory-dashboard',
    },
  });
});
connectionRequestsRoutes.get(
  '/factories/:factoryId/general',
  authorize('factories:view'),
  connectionRequestsController.getFactoryGeneral,
);
connectionRequestsRoutes.get(
  '/connected-measurement-points',
  authorize('cems_wpms_requests:view'),
  connectionRequestsController.listConnectedMeasurementPoints,
);
connectionRequestsRoutes.post(
  '/measurement-points',
  authorize('cems_wpms_requests:edit'),
  connectionRequestsController.createMeasurementPointRequest,
);
connectionRequestsRoutes.post(
  '/document-images',
  authorize('cems_wpms_requests:edit'),
  documentImageUpload.single('file'),
  connectionRequestsController.uploadDocumentImage,
);
connectionRequestsRoutes.post(
  '/parameters',
  authorize('cems_wpms_requests:edit'),
  connectionRequestsController.createParameterRequest,
);
connectionRequestsRoutes.get(
  '/:id',
  authorize('cems_wpms_requests:view'),
  connectionRequestsController.getById,
);
connectionRequestsRoutes.get(
  '/:id/detail',
  authorize('cems_wpms_requests:view'),
  connectionRequestsController.getDetail,
);
connectionRequestsRoutes.get(
  '/:id/device-configs',
  authorize('cems_wpms_requests:view'),
  connectionRequestsController.getDeviceConfigFormDetail,
);
connectionRequestsRoutes.get(
  '/:id/device-configs/:configId',
  authorize('cems_wpms_requests:view'),
  connectionRequestsController.getSingleDeviceConfigFormDetail,
);
connectionRequestsRoutes.post(
  '/',
  authorize('cems_wpms_requests:edit'),
  connectionRequestsController.create,
);
connectionRequestsRoutes.put(
  '/:id/form',
  authorize('cems_wpms_requests:edit'),
  connectionRequestsController.resubmit,
);
connectionRequestsRoutes.post(
  '/:id/review',
  authorize('cems_wpms_requests:approve'),
  connectionRequestsController.review,
);
connectionRequestsRoutes.post(
  '/:id/status',
  authorize('cems_wpms_requests:approve'),
  connectionRequestsController.changeStatus,
);
connectionRequestsRoutes.post(
  '/:id/device-configs',
  authorize('cems_wpms_requests:edit'),
  connectionRequestsController.createDeviceConfig,
);
connectionRequestsRoutes.post(
  '/:id/confirm-connection',
  authorize('cems_wpms_requests:edit'),
  connectionRequestsController.confirmConnection,
);
connectionRequestsRoutes.post(
  '/:id/verify-connection',
  authorize('cems_wpms_requests:approve'),
  connectionRequestsController.verifyConnection,
);
