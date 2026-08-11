import { RequestHandler, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { StatusCodes } from 'http-status-codes';
import multer from 'multer';
import { BadRequestError } from '../../shared/errors/AppError';
import { authenticate } from '../../shared/middlewares/authenticate';
import { authorize } from '../../shared/middlewares/authorize';
import { MAX_MONITORING_POINT_ATTACHMENT_FILE_SIZE_BYTES } from './monitoring-point-attachments';
import { allowedMonitoringPointFormAttachmentFileTypes } from './monitoring-point-form-attachments.service';
import { monitoringPointFormsController } from './monitoring-point-forms.controller';

export const monitoringPointFormsRoutes = Router();
export const MAX_CONCURRENT_MONITORING_POINT_ATTACHMENT_UPLOADS = 4;
export const MONITORING_POINT_ATTACHMENT_UPLOAD_RETRY_AFTER_SECONDS = 1;

const monitoringPointFormAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  defParamCharset: 'utf8',
  limits: {
    fileSize: MAX_MONITORING_POINT_ATTACHMENT_FILE_SIZE_BYTES,
    fieldNameSize: 64,
    files: 1,
    fields: 0,
  },
  fileFilter: (_req, file, callback) => {
    if (allowedMonitoringPointFormAttachmentFileTypes.has(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(new BadRequestError('Unsupported file type'));
  },
});
const monitoringPointFormAttachmentUploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?.id ?? 'missing-authenticated-user'),
  handler: (_req, res) => {
    res.status(StatusCodes.TOO_MANY_REQUESTS).json({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many attachment upload attempts. Please try again later.',
      },
    });
  },
});
const monitoringPointFormAttachmentUploadConcurrencyLimiter =
  createMonitoringPointAttachmentUploadConcurrencyLimiter();

monitoringPointFormsRoutes.get(
  '/attachments/:publicId/content',
  monitoringPointFormsController.downloadAttachment,
);

monitoringPointFormsRoutes.use(authenticate);

monitoringPointFormsRoutes.post(
  '/attachments',
  authorize('cems_wpms_requests:edit'),
  monitoringPointFormAttachmentUploadRateLimiter,
  monitoringPointFormAttachmentUploadConcurrencyLimiter,
  monitoringPointFormAttachmentUpload.single('file'),
  monitoringPointFormsController.uploadAttachment,
);

monitoringPointFormsRoutes.get(
  '/',
  authorize('cems_wpms_requests:view'),
  monitoringPointFormsController.list,
);
monitoringPointFormsRoutes.get(
  '/:id',
  authorize('cems_wpms_requests:view'),
  monitoringPointFormsController.getById,
);
monitoringPointFormsRoutes.post(
  '/',
  authorize('cems_wpms_requests:edit'),
  monitoringPointFormsController.create,
);
monitoringPointFormsRoutes.post(
  '/:id/select-eligible',
  authorize('eligible_factories:edit'),
  monitoringPointFormsController.selectEligible,
);
monitoringPointFormsRoutes.put(
  '/:id',
  authorize('cems_wpms_requests:edit'),
  monitoringPointFormsController.update,
);

export function createMonitoringPointAttachmentUploadConcurrencyLimiter(
  maxConcurrentUploads = MAX_CONCURRENT_MONITORING_POINT_ATTACHMENT_UPLOADS,
): RequestHandler {
  let activeUploads = 0;

  return (_req, res, next) => {
    if (activeUploads >= maxConcurrentUploads) {
      res.setHeader('Retry-After', String(MONITORING_POINT_ATTACHMENT_UPLOAD_RETRY_AFTER_SECONDS));
      res.status(StatusCodes.TOO_MANY_REQUESTS).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many concurrent attachment uploads. Please try again shortly.',
        },
      });
      return;
    }

    activeUploads += 1;
    let released = false;
    const release = (): void => {
      if (released) return;
      released = true;
      activeUploads -= 1;
      res.off('finish', release);
      res.off('close', release);
    };
    res.once('finish', release);
    res.once('close', release);
    next();
  };
}
