import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { env } from '../../config/env';
import { BadRequestError, ForbiddenError } from '../../shared/errors/AppError';
import { getScopeDetails } from '../../shared/middlewares/authorize';
import type { RegionalAccessDTO } from '../auth/regional-access';
import { createConnectionRequestDocumentImageService } from '../connection-requests/connection-request-document-image.service';
import { pomsFactoriesService } from './poms-factories.service';
import {
  createPomsFactoryEditRequestSchema,
  listPomsFactoriesQuerySchema,
  listPomsFactoryEditRequestsQuerySchema,
  pomsFactoryEditRequestFormQuerySchema,
  pomsFactoryFormQuerySchema,
  pomsFactoryEditRequestIdParamsSchema,
  pomsFactoryIdParamsSchema,
  resubmitPomsFactoryEditRequestSchema,
  reviewPomsFactoryEditRequestSchema,
} from './poms-factories.validator';

export const pomsFactoriesController = {
  async listFactories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const query = listPomsFactoriesQuerySchema.parse(req.query);
      const result = await pomsFactoriesService.listFactories(
        actorUserId,
        getScopeDetails(req, 'factories:view'),
        query.search,
        regionalAccess(req),
      );
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },

  async getFactoryDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { factoryId } = pomsFactoryIdParamsSchema.parse(req.params);
      const data = await pomsFactoriesService.getFactoryDetail(
        factoryId,
        actorUserId,
        getScopeDetails(req, 'factories:view'),
        regionalAccess(req),
      );
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async getFactoryForm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { factoryId } = pomsFactoryIdParamsSchema.parse(req.params);
      const query = pomsFactoryFormQuerySchema.parse(req.query);
      const data = await pomsFactoriesService.getFactoryForm(
        factoryId,
        actorUserId,
        getScopeDetails(req, 'factories:view'),
        query,
        regionalAccess(req),
      );
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async createEditRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { factoryId } = pomsFactoryIdParamsSchema.parse(req.params);
      const payload = createPomsFactoryEditRequestSchema.parse(req.body);
      const data = await pomsFactoriesService.createEditRequest(
        factoryId,
        payload,
        actorUserId,
        getScopeDetails(req, 'factories:edit'),
        regionalAccess(req),
      );
      res.status(StatusCodes.CREATED).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async listEditRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const query = listPomsFactoryEditRequestsQuerySchema.parse(req.query);
      const result = await pomsFactoriesService.listEditRequests(
        query,
        actorUserId,
        getScopeDetails(req, 'factories:view'),
        regionalAccess(req),
      );
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },

  async getEditRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { id } = pomsFactoryEditRequestIdParamsSchema.parse(req.params);
      const data = await pomsFactoriesService.getEditRequest(
        id,
        actorUserId,
        getScopeDetails(req, 'factories:view'),
        regionalAccess(req),
      );
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async getEditRequestForm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { id } = pomsFactoryEditRequestIdParamsSchema.parse(req.params);
      const query = pomsFactoryEditRequestFormQuerySchema.parse(req.query);
      const data = await pomsFactoriesService.getEditRequestForm(
        id,
        actorUserId,
        getScopeDetails(req, 'factories:view'),
        query,
        regionalAccess(req),
      );
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async resubmitEditRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { id } = pomsFactoryEditRequestIdParamsSchema.parse(req.params);
      const payload = resubmitPomsFactoryEditRequestSchema.parse(req.body);
      const data = await pomsFactoriesService.resubmitEditRequest(
        id,
        payload,
        actorUserId,
        getScopeDetails(req, 'factories:edit'),
        regionalAccess(req),
      );
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async cancelEditRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      const { id } = pomsFactoryEditRequestIdParamsSchema.parse(req.params);
      const data = await pomsFactoriesService.cancelEditRequest(
        id,
        actorUserId,
        getScopeDetails(req, 'factories:edit'),
        regionalAccess(req),
      );
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async reviewEditRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorUserId = requireActorUserId(req);
      requireAdminReviewActor(req);
      const { id } = pomsFactoryEditRequestIdParamsSchema.parse(req.params);
      const payload = reviewPomsFactoryEditRequestSchema.parse(req.body);
      const data = await pomsFactoriesService.reviewEditRequest(
        id,
        payload,
        actorUserId,
        {
          userType: req.user?.userType,
          roles: req.user?.roles ?? [],
        },
        getScopeDetails(req, 'factories:approve'),
        regionalAccess(req),
      );
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async uploadDocumentImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      requireActorUserId(req);
      if (!req.file) throw new BadRequestError('file is required');
      if (req.file.originalname.length > 255) {
        throw new BadRequestError('file name must be at most 255 characters', {
          field: 'file',
          maxLength: 255,
        });
      }
      const metadata = parseDocumentImageUploadMetadata(req.body);

      const service = createConnectionRequestDocumentImageService({
        uploadDir: env.UPLOAD_DIR,
        publicPath: env.UPLOAD_PUBLIC_PATH,
        publicBaseUrl: getPublicBaseUrl(req),
      });
      const documentImage = await service.createDocumentImage({
        title: metadata.title,
        description: metadata.description,
        link: metadata.link,
        file: {
          buffer: req.file.buffer,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
        },
      });
      const { storageKey: _storageKey, ...data } = documentImage;

      res.status(StatusCodes.CREATED).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },
};

function requireActorUserId(req: Request): number {
  if (typeof req.user?.id !== 'number') {
    throw new Error('Authenticated user id is required');
  }
  return req.user.id;
}

function requireAdminReviewActor(req: Request): void {
  if (req.user?.userType === 'admin' && req.user.roles?.includes('admin')) return;
  throw new ForbiddenError('POMS factory edit request review is limited to admin users');
}

function regionalAccess(req: Request): RegionalAccessDTO | null | undefined {
  return req.user?.regionalAccess;
}

function parseDocumentImageUploadMetadata(bodyValue: unknown): {
  title: string | null;
  description: string | null;
  link: string | null;
} {
  const body =
    bodyValue && typeof bodyValue === 'object' && !Array.isArray(bodyValue)
      ? (bodyValue as Record<string, unknown>)
      : {};
  const supportedFields = new Set(['title', 'description', 'link']);
  const unsupportedField = Object.keys(body).find((field) => !supportedFields.has(field));
  if (unsupportedField) {
    throw new BadRequestError('Unsupported multipart field', { field: unsupportedField });
  }

  return {
    title: optionalUploadText(body.title, 'title', 255),
    description: optionalUploadText(body.description, 'description', 1000),
    link: optionalUploadUrl(body.link, 'link', 2048),
  };
}

function optionalUploadText(value: unknown, field: string, maxLength: number): string | null {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value) || typeof value !== 'string') {
    throw new BadRequestError(`${field} must be supplied at most once`, { field });
  }

  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new BadRequestError(`${field} must be at most ${maxLength} characters`, {
      field,
      maxLength,
    });
  }
  return normalized;
}

function optionalUploadUrl(value: unknown, field: string, maxLength: number): string | null {
  const normalized = optionalUploadText(value, field, maxLength);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported URL protocol');
    const canonicalUrl = url.toString();
    if (canonicalUrl.length > maxLength) {
      throw new BadRequestError(`${field} must be at most ${maxLength} characters`, {
        field,
        maxLength,
      });
    }
    return canonicalUrl;
  } catch (error) {
    if (error instanceof BadRequestError) throw error;
    throw new BadRequestError(`${field} must be a valid URL`, { field });
  }
}

function getPublicBaseUrl(req: Request): string {
  if (env.PUBLIC_BASE_URL) return env.PUBLIC_BASE_URL;
  return `${req.protocol}://${req.get('host')}`;
}
