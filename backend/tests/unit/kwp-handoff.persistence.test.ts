import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';

jest.mock('../../src/config/database', () => ({
  db: Object.assign(jest.fn(), { transaction: jest.fn(), raw: jest.fn(), fn: { now: jest.fn() } }),
}));
jest.mock('../../src/modules/kwp-form-submissions/kwp-form-parameters', () => ({
  getKwpEligibleParameters: jest.fn(async () => ['BOD (mg/l)']),
  validateKwpParameterSelection: jest.fn(),
}));
jest.mock('../../src/modules/kwp-form-submissions/kwp-form-attachments.service', () => ({
  ...jest.requireActual<object>(
    '../../src/modules/kwp-form-submissions/kwp-form-attachments.service',
  ),
  validateStoredKwpAttachments: jest.fn(async () => undefined),
}));

import { db } from '../../src/config/database';
import { kwpFormSubmissionsRepository as repository } from '../../src/modules/kwp-form-submissions/kwp-form-submissions.repository';

type Row = Record<string, unknown>;
type TransactionCallback = (trx: Knex.Transaction) => Promise<unknown>;
let tables: Map<string, Row[]>;
let loseStatusRace: boolean;
const attachment = {
  attachmentType: 'GENERAL',
  originalFileName: 'report.pdf',
  storedFileName: 'report.pdf',
  mimeType: 'application/pdf',
  fileSize: 20,
  storagePath: 'kwp/form-attachments/2026/09/42/report.pdf',
};
const access = {
  actorUserId: 42,
  scope: 'OWN_FACTORY',
  publicBaseUrl: 'https://example.com',
  publicPath: '/uploads',
};
const common = { factoryId: 'F001', factoryName: 'โรงงานทดสอบ', connectedPointId: 8 };

beforeEach(() => {
  loseStatusRace = false;
  tables = new Map([
    ['factories', [{ id: 1, fid: 'F001', region_name: 'ภาคเหนือ' }]],
    ['cems_wpms_connected_measurement_points', [{ id: 8, factory_id: 'F001' }]],
    ['kwp_form_submission_sequences', [{ last_sequence: 0 }]],
  ]);
  const mockDb = db as unknown as jest.Mock;
  mockDb.mockImplementation((table) => query(String(table)));
  (
    db.transaction as unknown as jest.Mock<(callback: TransactionCallback) => Promise<unknown>>
  ).mockImplementation(async (callback) => {
    const snapshot = structuredClone(tables);
    try {
      return await callback(db as unknown as Knex.Transaction);
    } catch (error) {
      tables = snapshot;
      throw error;
    }
  });
});

describe('KWP handoff persistence through repository entry points', () => {
  it('creates, reads, retains, clears and resubmits KWP01 attachments and links', async () => {
    const payload = {
      ...common,
      issueReason: 'เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง' as const,
      unreportedParameters: ['BOD (mg/l)'],
      attachments: [attachment],
      attachmentLink: 'https://example.com/report',
    };
    const created = await repository.createKwp01(payload, access);
    const readAccess = { ...access, formType: 'KWP01' as const };
    const detail = await repository.getById(created.id, readAccess);
    expect(detail).toMatchObject({
      attachmentLink: payload.attachmentLink,
      attachments: [expect.objectContaining({ storagePath: attachment.storagePath })],
    });
    submission().status = 'REVISION_REQUESTED';
    const { attachments: _files, attachmentLink: _link, ...legacyPayload } = payload;
    const retained = await repository.updateKwp01(created.id, legacyPayload, readAccess);
    expect(retained.attachments).toHaveLength(1);
    expect(retained.attachmentLink).toBe(payload.attachmentLink);
    await repository.resubmit(created.id, {}, readAccess);
    expect(await repository.getById(created.id, readAccess)).toMatchObject({
      status: 'SUBMITTED',
      attachmentLink: payload.attachmentLink,
      attachments: [expect.objectContaining({ storagePath: attachment.storagePath })],
    });
    submission().status = 'REVISION_REQUESTED';
    const cleared = await repository.updateKwp01(
      created.id,
      { ...payload, attachments: [], attachmentLink: null },
      readAccess,
    );
    expect(cleared).toMatchObject({ attachments: [], attachmentLink: null });
    await repository.resubmit(created.id, {}, readAccess);
    expect(await repository.getById(created.id, readAccess)).toMatchObject({
      status: 'SUBMITTED',
      attachments: [],
      attachmentLink: null,
    });
  });

  it('round-trips KWP03 attachments at root and under the legacy report', async () => {
    const payload = {
      ...common,
      instruments: ['BOD'],
      measurementTimes: [],
      issueReasons: ['เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง' as const],
      failedParameters: ['BOD (mg/l)'],
      attachments: [attachment],
      attachmentLink: 'https://example.com/kwp03',
    };
    const created = await repository.createKwp03(payload, access);
    const readAccess = { ...access, formType: 'KWP03' as const };
    const detail = await repository.getById(created.id, readAccess);
    expect(detail.form).toBe('กวภ.03');
    expect(detail.attachments).toHaveLength(1);
    expect(detail.wpmsIssueReport?.attachments).toHaveLength(1);
    submission().status = 'REVISION_REQUESTED';
    const { attachments: _files, ...withoutFiles } = payload;
    expect(
      (await repository.updateKwp03(created.id, withoutFiles, readAccess)).attachments,
    ).toHaveLength(1);
    await repository.resubmit(created.id, {}, readAccess);
    const resubmitted = await repository.getById(created.id, readAccess);
    expect(resubmitted).toMatchObject({
      status: 'SUBMITTED',
      attachmentLink: payload.attachmentLink,
      attachments: [expect.objectContaining({ storagePath: attachment.storagePath })],
    });
    expect(resubmitted.wpmsIssueReport?.attachments).toEqual(resubmitted.attachments);
    submission().status = 'REVISION_REQUESTED';
    expect(
      await repository.updateKwp03(
        created.id,
        { ...payload, attachments: [], attachmentLink: null },
        readAccess,
      ),
    ).toMatchObject({ attachments: [], attachmentLink: null });
  });

  it.each(['KWP02', 'KWP04'] as const)(
    'preserves %s files, PDF metadata, period and link clearing through edit and resubmit',
    async (formType) => {
      const files = ['SAMPLING_PHOTO', 'LAB_REPORT'].map((attachmentType) => ({
        ...attachment,
        attachmentType,
        storedFileName: `${attachmentType}.pdf`,
        storagePath: `kwp/form-attachments/2026/09/42/${attachmentType}.pdf`,
      }));
      const payload = {
        ...common,
        reporterName: 'ผู้จัดทำรายงาน',
        reporterPosition: 'วิศวกร',
        reportRound: 3,
        reportYear: 2569,
        samplingPhotoLink: 'https://example.com/photo',
        labReportLink: 'https://example.com/lab',
        measurementItems: [
          { pollutant: 'BOD (mg/l)', attachments: files },
          { pollutant: 'COD (mg/l)' },
        ],
      };
      const created = await (
        formType === 'KWP02' ? repository.createKwp02 : repository.createKwp04
      )(payload, access);
      const readAccess = { ...access, formType };
      expect(await repository.getById(created.id, readAccess)).toMatchObject({
        reportRound: 3,
        reportYear: 2569,
        labReportLink: payload.labReportLink,
      });
      submission().status = 'REVISION_REQUESTED';
      await (formType === 'KWP02' ? repository.updateKwp02 : repository.updateKwp04)(
        created.id,
        { ...payload, reportRound: 4, labReportLink: null },
        readAccess,
      );
      await repository.resubmit(created.id, {}, readAccess);
      const detail = await repository.getById(created.id, readAccess);
      expect(detail).toMatchObject({
        requestNo: created.requestNo,
        status: 'SUBMITTED',
        submittedAt: expect.any(String),
        reporterName: payload.reporterName,
        reporterPosition: payload.reporterPosition,
        reportRound: 4,
        reportYear: 2569,
        labReportLink: null,
        samplingPhotoLink: payload.samplingPhotoLink,
        measurementItems: [
          {
            attachments: files.map((file) =>
              expect.objectContaining({
                ...file,
                fileUrl: `${access.publicBaseUrl}${access.publicPath}/${file.storagePath}`,
              }),
            ),
          },
          { attachments: [] },
        ],
      });
      if (!detail.submittedAt) throw new Error('Expected a submission timestamp');
      expect(new Date(detail.submittedAt).toISOString()).toBe(detail.submittedAt);
      submission().status = 'REVISION_REQUESTED';
      const {
        reportRound: _round,
        reportYear: _year,
        samplingPhotoLink: _photo,
        labReportLink: _lab,
        ...withoutPeriodAndLinks
      } = payload;
      const cleared = await (
        formType === 'KWP02' ? repository.updateKwp02 : repository.updateKwp04
      )(
        created.id,
        {
          ...withoutPeriodAndLinks,
          measurementItems: [{ pollutant: 'BOD (mg/l)', attachments: [] }],
        },
        readAccess,
      );
      expect(cleared).toMatchObject({
        reportRound: 4,
        reportYear: 2569,
        labReportLink: null,
        samplingPhotoLink: payload.samplingPhotoLink,
        measurementItems: [{ attachments: [] }],
      });
    },
  );

  it.each(['KWP02', 'KWP04'] as const)(
    'does not invent a report period for old %s data',
    async (formType) => {
      seedSubmission('SUBMITTED');
      submission().form_type = formType;
      expect(await repository.getById(1, { ...access, formType })).toMatchObject({
        reportRound: null,
        reportYear: null,
        samplingPhotoLink: null,
        labReportLink: null,
      });
    },
  );

  it('writes cancellation history and preserves previous review metadata', async () => {
    seedSubmission('REJECTED');
    expect(await repository.changeWorkflowStatus(1, { action: 'CANCEL' }, access)).toMatchObject({
      status: 'CANCELLED',
      allowedActions: [],
    });
    expect(submission()).toMatchObject({ reviewed_by: 77, officer_note: 'previous review' });
    expect(tables.get('kwp_form_status_history')).toEqual([
      expect.objectContaining({ status: 'CANCELLED', changed_by: 42 }),
    ]);
  });
  it('does not write cancellation history when a concurrent status update wins', async () => {
    seedSubmission('SUBMITTED');
    loseStatusRace = true;
    await expect(
      repository.changeWorkflowStatus(1, { action: 'CANCEL' }, access),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(tables.get('kwp_form_status_history') ?? []).toHaveLength(0);
  });
  it('rejects requests outside the access-filtered query', async () => {
    await expect(
      repository.changeWorkflowStatus(999, { action: 'CANCEL' }, access),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
  it('does not advertise cancellation to a view-only operator', async () => {
    seedSubmission('SUBMITTED');
    expect(await repository.getWorkflow(1, { ...access, canEdit: false })).toMatchObject({
      allowedActions: [],
    });
  });
});

function submission(): Row {
  const row = tables.get('kwp_form_submissions')?.[0];
  if (!row) throw new Error('Expected a seeded or created submission');
  return row;
}
function seedSubmission(status: string) {
  tables.set('kwp_form_submissions', [
    {
      id: 1,
      form_type: 'KWP01',
      status,
      submission_no: 'F01-04-0001/2569',
      factory_id: 'F001',
      reviewed_by: 77,
      officer_note: 'previous review',
      created_at: new Date(),
      updated_at: new Date(),
    },
  ]);
}

// In-memory query adapter exercises repository sequencing, not SQL Server locking behavior.
function query(name: string): Knex.QueryBuilder {
  const table = name.split(' as ')[0];
  const filters: Array<(row: Row) => boolean> = [];
  const key = (column: string) => column.slice(column.lastIndexOf('.') + 1);
  const rows = () =>
    (tables.get(table) ?? []).filter((row) => filters.every((filter) => filter(row)));
  const chain: Record<string, unknown> = {};
  for (const method of ['leftJoin', 'join', 'modify', 'whereExists', 'orderBy', 'forUpdate'])
    chain[method] = () => chain;
  chain.where = (column: unknown, value: unknown) => {
    if (typeof column === 'string') filters.push((row) => row[key(column)] === value);
    return chain;
  };
  chain.whereNull = (column: string) => {
    filters.push((row) => row[key(column)] == null);
    return chain;
  };
  chain.whereIn = (column: string, values: unknown[]) => {
    filters.push((row) => values.includes(row[key(column)]));
    return chain;
  };
  chain.select = () => chain;
  chain.first = async () => rows()[0];
  chain.then = (resolve: (value: Row[]) => unknown, reject?: (error: unknown) => unknown) =>
    Promise.resolve(rows()).then(resolve, reject);
  chain.update = async (values: Row) => {
    if (loseStatusRace && table === 'kwp_form_submissions') return 0;
    const found = rows();
    found.forEach((row) => Object.assign(row, values));
    return found.length;
  };
  chain.delete = async () => {
    const found = rows();
    tables.set(
      table,
      (tables.get(table) ?? []).filter((row) => !found.includes(row)),
    );
    return found.length;
  };
  chain.insert = (values: Row | Row[]) => {
    const all = tables.get(table) ?? [];
    const added = (Array.isArray(values) ? values : [values]).map((row, index) => ({
      id: all.length + index + 1,
      ...row,
    }));
    tables.set(table, [...all, ...added]);
    return {
      then: (resolve: (value: number) => unknown, reject?: (error: unknown) => unknown) =>
        Promise.resolve(added.length).then(resolve, reject),
      returning: async () => added,
    };
  };
  return chain as unknown as Knex.QueryBuilder;
}
