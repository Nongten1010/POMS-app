import { z } from 'zod';

export const MONITORING_POINT_ATTACHMENT_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const;

export const MAX_MONITORING_POINT_ATTACHMENT_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export type MonitoringPointAttachmentFileType =
  (typeof MONITORING_POINT_ATTACHMENT_FILE_TYPES)[number];

const httpUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2048)
  .refine(isHttpUrl, { message: 'URL must use http or https' });

const nullableAttachmentLabelSchema = z
  .preprocess((value) => {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') return value;
    return value.trim() || null;
  }, z.string().max(255).nullable())
  .default(null);

export const monitoringPointAttachmentLinkSchema = z
  .object({
    label: nullableAttachmentLabelSchema,
    url: httpUrlSchema,
  })
  .strict();

export const monitoringPointAttachmentLinksSchema = z.array(monitoringPointAttachmentLinkSchema);

export type MonitoringPointAttachmentLink = z.infer<typeof monitoringPointAttachmentLinkSchema>;

export function parseMonitoringPointAttachmentLinks(
  value: string | null | undefined,
): MonitoringPointAttachmentLink[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      const result = monitoringPointAttachmentLinkSchema.safeParse(item);
      return result.success ? [result.data] : [];
    });
  } catch {
    return [];
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}
