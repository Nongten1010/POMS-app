import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import type { UploadedLawFile } from './laws.types';
import { lawsService, type LawServiceContract } from './laws.service';
import { lawIdParamsSchema, lawListQuerySchema, parseLawInput } from './laws.validator';

export interface LawsController {
  list(req: Request, res: Response, next: NextFunction): Promise<void>;
  create(req: Request, res: Response, next: NextFunction): Promise<void>;
  update(req: Request, res: Response, next: NextFunction): Promise<void>;
  delete(req: Request, res: Response, next: NextFunction): Promise<void>;
  download(req: Request, res: Response, next: NextFunction): Promise<void>;
}

export function createLawsController(service: LawServiceContract): LawsController {
  return {
    async list(req, res, next): Promise<void> {
      try {
        lawListQuerySchema.parse(req.query);
        const data = await service.list();
        res.status(StatusCodes.OK).json({ success: true, data });
      } catch (error) {
        next(error);
      }
    },

    async create(req, res, next): Promise<void> {
      try {
        const actorUserId = requireActorUserId(req);
        const input = parseLawInput(req.body);
        const data = await service.create(input, toUploadedLawFile(req.file), actorUserId);
        res
          .status(StatusCodes.CREATED)
          .location(`${req.baseUrl}/${data.id}`)
          .json({ success: true, data });
      } catch (error) {
        next(error);
      }
    },

    async update(req, res, next): Promise<void> {
      try {
        const actorUserId = requireActorUserId(req);
        const { id } = lawIdParamsSchema.parse(req.params);
        const input = parseLawInput(req.body);
        const data = await service.update(id, input, toUploadedLawFile(req.file), actorUserId);
        res.status(StatusCodes.OK).json({ success: true, data });
      } catch (error) {
        next(error);
      }
    },

    async delete(req, res, next): Promise<void> {
      try {
        const actorUserId = requireActorUserId(req);
        const { id } = lawIdParamsSchema.parse(req.params);
        const data = await service.delete(id, actorUserId);
        res.status(StatusCodes.OK).json({ success: true, data });
      } catch (error) {
        next(error);
      }
    },

    async download(req, res, next): Promise<void> {
      try {
        const { id } = lawIdParamsSchema.parse(req.params);
        const content = await service.getFile(id);
        res.setHeader('Content-Type', content.mimeType);
        res.setHeader('Content-Length', String(content.fileSize));
        res.setHeader('Content-Disposition', buildAttachmentContentDisposition(content.fileName));
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'public, no-store, max-age=0');
        res.status(StatusCodes.OK);
        await pipeline(createReadStream(content.filePath), res);
      } catch (error) {
        if (res.headersSent || res.destroyed) {
          if (!res.destroyed) res.destroy(error instanceof Error ? error : undefined);
          return;
        }
        next(error);
      }
    },
  };
}

function requireActorUserId(req: Request): number {
  const actorUserId = req.user?.id;
  if (!actorUserId) throw new Error('Authenticated user missing from request');
  return actorUserId;
}

function toUploadedLawFile(file: Express.Multer.File | undefined): UploadedLawFile | undefined {
  if (!file) return undefined;
  return {
    buffer: file.buffer,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
  };
}

function buildAttachmentContentDisposition(fileName: string): string {
  const asciiFileName = fileName.replace(/[^\x20-\x7e]|["\\\r\n]/g, '_');
  const encodedFileName = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodedFileName}`;
}

export const lawsController = createLawsController(lawsService);
