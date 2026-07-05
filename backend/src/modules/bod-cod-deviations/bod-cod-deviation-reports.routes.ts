import { Router } from 'express';
import multer from 'multer';
import { BadRequestError } from '../../shared/errors/AppError';
import { authenticate } from '../../shared/middlewares/authenticate';
import { authorize } from '../../shared/middlewares/authorize';
import {
  allowedBodCodAttachmentFileTypes,
  MAX_BOD_COD_ATTACHMENT_FILE_SIZE_BYTES,
} from './bod-cod-deviation-attachments.service';
import { bodCodDeviationReportsController } from './bod-cod-deviation-reports.controller';

export const bodCodDeviationReportsRoutes = Router();
const bodCodAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  defParamCharset: 'utf8',
  limits: {
    fileSize: MAX_BOD_COD_ATTACHMENT_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (allowedBodCodAttachmentFileTypes.has(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(new BadRequestError('Unsupported file type'));
  },
});

bodCodDeviationReportsRoutes.use(authenticate);

bodCodDeviationReportsRoutes.post(
  '/attachments',
  authorize('bod_cod_errors:edit'),
  bodCodAttachmentUpload.single('file'),
  bodCodDeviationReportsController.uploadAttachment,
);
bodCodDeviationReportsRoutes.get(
  '/factories',
  authorize('bod_cod_errors:view'),
  bodCodDeviationReportsController.listFactories,
);
bodCodDeviationReportsRoutes.put(
  '/:id/resubmission',
  authorize('bod_cod_errors:edit'),
  bodCodDeviationReportsController.resubmitReport,
);
bodCodDeviationReportsRoutes.post(
  '/:id/workflow-actions',
  authorize('bod_cod_errors:approve'),
  bodCodDeviationReportsController.changeWorkflowStatus,
);
bodCodDeviationReportsRoutes.post(
  '/:id/result-notice',
  authorize('bod_cod_errors:approve'),
  bodCodDeviationReportsController.upsertResultNotice,
);
bodCodDeviationReportsRoutes.put(
  '/:id/result-notice',
  authorize('bod_cod_errors:approve'),
  bodCodDeviationReportsController.upsertResultNotice,
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
