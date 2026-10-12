import { validateUploadFileMetadata } from '../../shared/utils/upload-file-policy';
import { pomsStatusManagementRoutes } from './poms-status-management.routes';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import multer from 'multer';
import { authenticate } from '../../shared/middlewares/authenticate';
import { authorize } from '../../shared/middlewares/authorize';
import { MAX_DOCUMENT_FILE_SIZE_BYTES } from '../connection-requests/connection-request-document-image.service';
import { pomsFactoriesController } from './poms-factories.controller';

export const pomsFactoriesRoutes = Router();
const documentImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_DOCUMENT_FILE_SIZE_BYTES,
    files: 1,
    fields: 3,
    parts: 5,
    fieldNameSize: 64,
    fieldSize: 4096,
  },
  fileFilter: (_req, file, callback) => {
    try {
      validateUploadFileMetadata(file.originalname, file.mimetype);
      callback(null, true);
    } catch (error) {
      callback(error instanceof Error ? error : new Error('Invalid uploaded file'));
    }
  },
});

pomsFactoriesRoutes.use(authenticate);
pomsFactoriesRoutes.use(pomsStatusManagementRoutes);

pomsFactoriesRoutes.get('/', authorize('factories:view'), pomsFactoriesController.listFactories);
pomsFactoriesRoutes.get(
  '/edit-requests',
  authorize('factories:view'),
  pomsFactoriesController.listEditRequests,
);
pomsFactoriesRoutes.get(
  '/edit-requests/:id',
  authorize('factories:view'),
  pomsFactoriesController.getEditRequest,
);
pomsFactoriesRoutes.get(
  '/edit-requests/:id/form',
  authorize('factories:view'),
  pomsFactoriesController.getEditRequestForm,
);
pomsFactoriesRoutes.put(
  '/edit-requests/:id/resubmission',
  authorize('factories:view'),
  authorize('factories:edit'),
  pomsFactoriesController.resubmitEditRequest,
);
pomsFactoriesRoutes.post(
  '/edit-requests/:id/cancel',
  authorize('factories:view'),
  authorize('factories:edit'),
  pomsFactoriesController.cancelEditRequest,
);
pomsFactoriesRoutes.post(
  '/edit-requests/:id/review',
  authorize('factories:view'),
  authorize('factories:approve'),
  pomsFactoriesController.reviewEditRequest,
);
pomsFactoriesRoutes.post(
  '/document-images',
  authorize('factories:edit'),
  parseDocumentImageUpload,
  pomsFactoriesController.uploadDocumentImage,
);
pomsFactoriesRoutes.get(
  '/:factoryId/form',
  authorize('factories:view'),
  pomsFactoriesController.getFactoryForm,
);
pomsFactoriesRoutes.get(
  '/:factoryId',
  authorize('factories:view'),
  pomsFactoriesController.getFactoryDetail,
);
pomsFactoriesRoutes.post(
  '/:factoryId/edit-requests',
  authorize('factories:view'),
  authorize('factories:edit'),
  pomsFactoriesController.createEditRequest,
);

function parseDocumentImageUpload(req: Request, res: Response, next: NextFunction): void {
  documentImageUpload.single('file')(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'FILE_UPLOAD_FAILED',
          message: 'ไม่สามารถอัปโหลดไฟล์ได้',
          details: {
            field: error.field ?? 'file',
            reason: error.code,
          },
        },
      });
      return;
    }

    next(error);
  });
}
