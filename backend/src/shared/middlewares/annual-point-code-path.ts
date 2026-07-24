import type { RequestHandler } from 'express';
import { isAnnualMonitoringPointCode } from '../utils/monitoring-point-code';

export const normalizeAnnualPointCodePath: RequestHandler = (req, _res, next) => {
  const { stationId, buddhistYear } = req.params;
  if (!buddhistYear) return next();

  const annualPointCode = `${stationId}/${buddhistYear}`;
  if (isAnnualMonitoringPointCode(annualPointCode)) {
    req.params = { stationId: annualPointCode };
  }

  return next();
};
