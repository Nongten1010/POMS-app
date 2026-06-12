import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { integrationDeviceConfigParamsSchema } from './integration-device-configs.validator';
import { integrationDeviceConfigsService } from './integration-device-configs.service';

export const integrationDeviceConfigsController = {
  async getByStationId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { stationId } = integrationDeviceConfigParamsSchema.parse(req.params);
      const data = await integrationDeviceConfigsService.getByStationId(stationId);
      res.status(StatusCodes.OK).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
