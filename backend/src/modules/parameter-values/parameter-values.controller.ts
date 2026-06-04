import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { parameterValuesService } from './parameter-values.service';
import {
  latestParameterValueQuerySchema,
  listParameterValuesQuerySchema,
} from './parameter-values.validator';

export const parameterValuesController = {
  async listTables(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await parameterValuesService.listTables();
      res.status(StatusCodes.OK).json({ success: true, data, meta: { total: data.length } });
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listParameterValuesQuerySchema.parse(req.query);
      const result = await parameterValuesService.list(query);
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async latest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = latestParameterValueQuerySchema.parse(req.query);
      const result = await parameterValuesService.list(query);
      res
        .status(StatusCodes.OK)
        .json({ success: true, data: result.data[0] ?? null, meta: result.meta });
    } catch (err) {
      next(err);
    }
  },
};
