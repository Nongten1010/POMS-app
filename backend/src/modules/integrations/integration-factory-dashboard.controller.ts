import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { integrationFactoryDashboardService } from './integration-factory-dashboard.service';
import { integrationFactoryDashboardParamsSchema } from './integration-factory-dashboard.validator';

export const integrationFactoryDashboardController = {
  async getByRegistrationNo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { registrationNo } = integrationFactoryDashboardParamsSchema.parse(req.params);
      const result = await integrationFactoryDashboardService.getByRegistrationNo(registrationNo);
      res.set('Cache-Control', 'no-store');
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },
};
