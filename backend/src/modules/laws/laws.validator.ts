import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';
import { AppError } from '../../shared/errors/AppError';
import { LAW_CATEGORIES, LAW_TYPES, type LawInput } from './laws.types';

const MIN_PUBLISHED_DATE = '1900-01-01';
const MAX_PUBLISHED_DATE = '9999-12-31';

export const lawInputSchema = z
  .object({
    title: z
      .string({ error: 'กรุณาระบุชื่อรายการ' })
      .trim()
      .min(1, 'กรุณาระบุชื่อรายการ')
      .max(500, 'ชื่อรายการต้องไม่เกิน 500 ตัวอักษร'),
    category: z.enum(LAW_CATEGORIES, { error: 'กรุณาเลือกหมวดหมู่' }),
    type: z.enum(LAW_TYPES, { error: 'กรุณาเลือกประเภทเอกสาร' }),
    publishedDate: z
      .string({ error: 'กรุณาระบุวันที่เผยแพร่' })
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'วันที่ต้องอยู่ในรูปแบบ YYYY-MM-DD')
      .refine(isRealCalendarDate, 'วันที่เผยแพร่ไม่ถูกต้อง')
      .refine(
        (value) => value >= MIN_PUBLISHED_DATE && value <= MAX_PUBLISHED_DATE,
        `วันที่เผยแพร่ต้องอยู่ระหว่าง ${MIN_PUBLISHED_DATE} และ ${MAX_PUBLISHED_DATE}`,
      ),
  })
  .strict();

export const lawIdParamsSchema = z.object({
  id: z.uuid('รหัสรายการกฎหมายไม่ถูกต้อง'),
});

export const lawListQuerySchema = z.object({}).strict();

export function parseLawInput(value: unknown): LawInput {
  const result = lawInputSchema.safeParse(value);
  if (result.success) return result.data;

  const details: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = typeof issue.path[0] === 'string' ? issue.path[0] : '_form';
    details[field] ??= issue.message;
  }
  throw lawValidationError(details);
}

export function lawValidationError(details: Record<string, string>): AppError {
  return new AppError(
    'ข้อมูลรายการกฎหมายไม่ถูกต้อง',
    StatusCodes.BAD_REQUEST,
    'VALIDATION_ERROR',
    details,
  );
}

function isRealCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}
