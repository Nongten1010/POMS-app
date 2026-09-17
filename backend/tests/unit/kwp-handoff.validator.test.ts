import { describe, expect, it } from '@jest/globals';
import {
  changeKwpWorkflowStatusSchema,
  createKwp01SubmissionSchema,
  createKwp02SubmissionSchema,
  createKwp03SubmissionSchema,
  createKwp04SubmissionSchema,
} from '../../src/modules/kwp-form-submissions/kwp-form-submissions.validator';

const common = { factoryId: 'FID-001', factoryName: 'โรงงานทดสอบ' };
const attachment = {
  attachmentType: 'GENERAL',
  originalFileName: 'report.pdf',
  storedFileName: 'report.pdf',
  mimeType: 'application/pdf',
  fileSize: 10 * 1024 * 1024,
  storagePath: 'kwp/form-attachments/2026/09/report.pdf',
};
const kwp01 = {
  ...common,
  issueReason: 'เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง',
  unreportedParameters: ['NOx (ppm)'],
};
const kwp03 = {
  ...common,
  instruments: ['BOD'],
  issueReasons: ['เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง'],
  failedParameters: ['BOD (mg/l)'],
};

describe('KWP frontend handoff contract', () => {
  it.each([
    [createKwp01SubmissionSchema, kwp01],
    [createKwp03SubmissionSchema, kwp03],
  ])('accepts general attachments and clears links explicitly', (schema, payload) => {
    expect(
      schema.parse({
        ...payload,
        attachments: [attachment],
        attachmentLink: 'https://example.com/report',
      }),
    ).toMatchObject({ attachments: [attachment], attachmentLink: 'https://example.com/report' });
    expect(schema.parse({ ...payload, attachments: [], attachmentLink: null })).toMatchObject({
      attachments: [],
      attachmentLink: null,
    });
    expect(schema.safeParse({ ...payload, attachments: Array(6).fill(attachment) }).success).toBe(
      false,
    );
  });
  it.each([createKwp02SubmissionSchema, createKwp04SubmissionSchema])(
    'rejects attachment types outside the two measurement document sets',
    (schema) => {
      for (const attachmentType of ['GENERAL', 'RATA_REPORT', 'lab_report', 'OTHER']) {
        const result = schema.safeParse({
          ...common,
          measurementItems: [
            {
              pollutant: 'BOD (mg/l)',
              attachments: [{ ...attachment, attachmentType, fileSize: 100 }],
            },
          ],
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toEqual([
            'measurementItems',
            0,
            'attachments',
            0,
            'attachmentType',
          ]);
        }
      }
    },
  );
  it.each([createKwp02SubmissionSchema, createKwp04SubmissionSchema])(
    'counts each document set across all measurement rows',
    (schema) => {
      const files = (attachmentType: string, count: number) =>
        Array.from({ length: count }, (_, index) => ({
          ...attachment,
          attachmentType,
          originalFileName: `${attachmentType}-${index}.pdf`,
          fileSize: 5 * 1024 * 1024,
        }));
      for (const type of ['SAMPLING_PHOTO', 'LAB_REPORT']) {
        const measurementItems = [
          { pollutant: 'BOD (mg/l)', attachments: files(type, 3) },
          { pollutant: 'COD (mg/l)', attachments: files(type, 3) },
        ];
        expect(schema.safeParse({ ...common, measurementItems }).success).toBe(false);
      }
      expect(
        schema.safeParse({
          ...common,
          measurementItems: [
            {
              pollutant: 'BOD (mg/l)',
              attachments: [...files('SAMPLING_PHOTO', 5), ...files('LAB_REPORT', 5)],
            },
          ],
        }).success,
      ).toBe(true);
    },
  );
  it.each([createKwp02SubmissionSchema, createKwp04SubmissionSchema])(
    'accepts Buddhist report periods without converting the year',
    (schema) => {
      const payload = { ...common, measurementItems: [{ pollutant: 'BOD (mg/l)' }] };
      expect(
        schema.parse({
          ...payload,
          reportRound: 3,
          reportYear: 2569,
          samplingPhotoLink: null,
          labReportLink: 'https://example.com/lab',
        }),
      ).toMatchObject({ reportRound: 3, reportYear: 2569, samplingPhotoLink: null });
      expect(schema.parse(payload)).not.toHaveProperty('reportYear');
      for (const values of [
        { reportRound: 0 },
        { reportRound: 1.5 },
        { reportYear: 2026 },
        { reportYear: 10000 },
      ]) {
        expect(schema.safeParse({ ...payload, ...values }).success).toBe(false);
      }
      expect(
        schema.safeParse({
          ...payload,
          measurementItems: [
            {
              pollutant: 'BOD (mg/l)',
              attachments: [{ ...attachment, attachmentType: 'LAB_REPORT' }],
            },
          ],
        }).success,
      ).toBe(false);
    },
  );
  it.each([
    'javascript:alert(1)',
    'data:text/html,test',
    'file:///etc/passwd',
    'https://user:password@example.com',
    '//example.com',
  ])('rejects unsafe attachment URL %s', (attachmentLink) => {
    expect(createKwp01SubmissionSchema.safeParse({ ...kwp01, attachmentLink }).success).toBe(false);
  });
  it('accepts CANCEL without allowing unexpected payload fields', () => {
    expect(changeKwpWorkflowStatusSchema.parse({ action: 'CANCEL' })).toMatchObject({
      action: 'CANCEL',
    });
    expect(
      changeKwpWorkflowStatusSchema.safeParse({ action: 'CANCEL', actorUserId: 99 }).success,
    ).toBe(false);
  });
});
