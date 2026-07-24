import { z } from 'zod';
import { isAnnualMonitoringPointCode } from '../../shared/utils/monitoring-point-code';

export const integrationDeviceConfigParamsSchema = z
  .object({
    stationId: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .refine(
        (value) => /^[A-Za-z0-9_-]+$/.test(value) || isAnnualMonitoringPointCode(value),
        'stationId must be a legacy safe identifier or an annual monitoring point code',
      ),
  })
  .strict();
