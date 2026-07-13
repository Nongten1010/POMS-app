import { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';
import multer from 'multer';
import { AppError } from '../errors/AppError';
import { logger } from '../../config/logger';

export const notFoundHandler = (req: Request, res: Response, _next: NextFunction): void => {
  res.status(StatusCodes.NOT_FOUND).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
    },
  });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.flatten().fieldErrors,
        issues: err.issues.map((issue) => ({
          code: issue.code,
          path: [...issue.path],
          pathString: issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      error: {
        code: 'UPLOAD_ERROR',
        message: err.message,
        details: {
          field: err.field ?? null,
          reason: err.code,
        },
      },
    });
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(`[${req.method} ${req.originalUrl}] ${err.message}`, err);
    }
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  logger.error(`[${req.method} ${req.originalUrl}] Unhandled error`, err);
  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
};
