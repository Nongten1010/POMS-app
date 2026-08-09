import { z } from 'zod';
import { isAnnualMonitoringPointCode } from '../../shared/utils/monitoring-point-code';
import { PARAMETER_VALUE_INTERVALS } from './parameter-values.types';

export const stationIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(
    (value) => /^[A-Za-z][A-Za-z0-9_]*$/.test(value) || isAnnualMonitoringPointCode(value),
    'stationId must be a legacy safe identifier or an annual monitoring point code',
  );

export const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must use YYYY-MM-DD format')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)), {
    message: 'date must be valid',
  });

export const monthSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}$/, 'month must use YYYY-MM format')
  .refine((value) => {
    const month = Number(value.slice(5, 7));
    return month >= 1 && month <= 12;
  }, 'month must be valid');

export const listParameterValuesQuerySchema = z
  .object({
    stationId: stationIdSchema,
    interval: z.enum(PARAMETER_VALUE_INTERVALS).default('real'),
    startDate: dateSchema,
    endDate: dateSchema,
  })
  .strict()
  .refine((query) => query.startDate <= query.endDate, {
    message: 'startDate must be less than or equal to endDate',
    path: ['startDate'],
  });

export const latestParameterValueQuerySchema = z
  .object({
    stationId: stationIdSchema,
    interval: z.enum(PARAMETER_VALUE_INTERVALS).default('real'),
  })
  .strict();

export const connectionTestQuerySchema = z
  .object({
    stationId: stationIdSchema,
  })
  .strict();

export const connectedMeasurementPointDetailParamsSchema = z
  .object({
    stationId: stationIdSchema,
  })
  .strict();

export const measurementStatisticsQuerySchema = z
  .object({
    date: dateSchema,
  })
  .strict();

export const calendarStatusQuerySchema = z
  .object({
    month: monthSchema,
  })
  .strict();

const exactExportDateSchema = dateSchema.refine(
  (value) => new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value,
  'date must exist in the Gregorian calendar',
);

export const measurementCsvExportQuerySchema = z
  .object({
    frequency: z.enum(['hourly', 'daily']),
    startDate: exactExportDateSchema,
    endDate: exactExportDateSchema,
    parameters: z.preprocess(
      (value) => (Array.isArray(value) ? value : [value]),
      z.array(z.string().trim().min(1)).min(1),
    ),
  })
  .strict()
  .refine((query) => query.startDate <= query.endDate, {
    message: 'startDate must be less than or equal to endDate',
    path: ['startDate'],
  })
  .refine(
    (query) =>
      query.frequency !== 'hourly' || inclusiveDateCount(query.startDate, query.endDate) <= 366,
    {
      message: 'hourly export range must not exceed 366 inclusive days',
      path: ['endDate'],
    },
  )
  .refine(
    (query) =>
      query.frequency !== 'daily' || withinTenCalendarYears(query.startDate, query.endDate),
    {
      message: 'daily export range must not exceed ten calendar years',
      path: ['endDate'],
    },
  );

function inclusiveDateCount(startDate: string, endDate: string): number {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((Date.parse(endDate) - Date.parse(startDate)) / millisecondsPerDay) + 1;
}

function withinTenCalendarYears(startDate: string, endDate: string): boolean {
  const exclusiveEnd = new Date(`${startDate}T00:00:00.000Z`);
  exclusiveEnd.setUTCFullYear(exclusiveEnd.getUTCFullYear() + 10);
  return Date.parse(`${endDate}T00:00:00.000Z`) < exclusiveEnd.getTime();
}

export type ListParameterValuesQuerySchemaInput = z.infer<typeof listParameterValuesQuerySchema>;
export type LatestParameterValueQuerySchemaInput = z.infer<typeof latestParameterValueQuerySchema>;
export type ConnectionTestQuerySchemaInput = z.infer<typeof connectionTestQuerySchema>;
export type MeasurementStatisticsQuerySchemaInput = z.infer<
  typeof measurementStatisticsQuerySchema
>;
export type CalendarStatusQuerySchemaInput = z.infer<typeof calendarStatusQuerySchema>;
export type MeasurementCsvExportQuerySchemaInput = z.infer<typeof measurementCsvExportQuerySchema>;
