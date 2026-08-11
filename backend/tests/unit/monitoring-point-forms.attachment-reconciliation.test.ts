import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDb = jest.fn();

jest.mock('../../src/config/database', () => ({
  db: mockDb,
}));

import { monitoringPointFormsRepository } from '../../src/modules/monitoring-point-forms/monitoring-point-forms.repository';
import { hashMonitoringPointAttachmentUploadToken } from '../../src/modules/monitoring-point-forms/monitoring-point-form-attachments.service';
import type { MonitoringPointInput } from '../../src/modules/monitoring-point-forms/monitoring-point-forms.types';

type StoredRow = Record<string, unknown>;

interface CapturedUpdate {
  filters: Filter[];
  values: StoredRow;
}

interface HarnessWrites {
  formUpdates: CapturedUpdate[];
  pointUpdates: CapturedUpdate[];
  pointInserts: StoredRow[];
  attachmentUpdates: CapturedUpdate[];
}

interface HarnessOptions {
  points: StoredRow[];
  attachments?: StoredRow[];
}

type Filter =
  | { kind: 'equal'; column: string; value: unknown }
  | { kind: 'compare'; column: string; operator: string; value: unknown }
  | { kind: 'in'; column: string; values: unknown[] }
  | { kind: 'null'; column: string }
  | { kind: 'not-null'; column: string };

interface QueryBuilderMock extends PromiseLike<StoredRow[]> {
  where(column: string, value: unknown): QueryBuilderMock;
  where(column: string, operator: string, value: unknown): QueryBuilderMock;
  whereNull(column: string): QueryBuilderMock;
  whereNotNull(column: string): QueryBuilderMock;
  whereIn(column: string, values: unknown[]): QueryBuilderMock;
  orderBy(column: string, direction?: string): QueryBuilderMock;
  forUpdate(): QueryBuilderMock;
  select(...columns: string[]): QueryBuilderMock;
  first(...columns: string[]): Promise<StoredRow | undefined>;
  update(values: StoredRow): Promise<number>;
  insert(values: StoredRow): QueryBuilderMock;
  returning(column: string): Promise<Array<{ id: number }>>;
}

describe('monitoringPointFormsRepository attachment reconciliation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('preserves resources for the current frontend no-id payload by unique system type and point code', async () => {
    const storedLink = { label: 'คู่มือเดิม', url: 'https://example.com/cems-guide' };
    const harness = createUpdateHarness({
      points: [
        makePointRow({
          id: 11,
          system_type: 'CEMS',
          point_code: 'S0001',
          point_name: 'ปล่องหลัก',
          attachment_links_json: JSON.stringify([storedLink]),
        }),
        makePointRow({
          id: 12,
          system_type: 'WPMS',
          point_code: 'W0001',
          point_name: 'น้ำทิ้ง',
        }),
      ],
      attachments: [makeAttachmentRow({ id: 501, monitoring_point_id: 11 })],
    });

    await updateForm([
      { systemType: 'WPMS', pointCode: ' w0001 ', pointName: 'น้ำทิ้งแก้ไข' },
      { systemType: 'CEMS', pointCode: 's0001', pointName: 'ปล่องหลักแก้ไข' },
    ]);

    expect(harness.writes.pointInserts).toEqual([]);
    expect(harness.writes.pointUpdates).toHaveLength(2);
    expect(pointUpdateFor(harness.writes, 11)?.values).toMatchObject({
      point_code: 's0001',
      point_name: 'ปล่องหลักแก้ไข',
      attachment_links_json: JSON.stringify([storedLink]),
    });
    expect(pointUpdateFor(harness.writes, 12)?.values).toMatchObject({
      point_code: ' w0001 ',
      point_name: 'น้ำทิ้งแก้ไข',
      attachment_links_json: '[]',
    });
    expect(harness.writes.attachmentUpdates).toEqual([]);
  });

  it('updates an explicit point id in place and preserves omitted resources after identity fields change', async () => {
    const storedLink = { label: null, url: 'https://example.com/original' };
    const harness = createUpdateHarness({
      points: [
        makePointRow({
          id: 21,
          system_type: 'CEMS',
          point_code: 'S0009',
          point_name: 'ปล่องเดิม',
          attachment_links_json: JSON.stringify([storedLink]),
        }),
      ],
      attachments: [makeAttachmentRow({ id: 601, monitoring_point_id: 21 })],
    });

    await updateForm([
      {
        id: 21,
        systemType: 'WPMS',
        pointCode: 'W0099',
        pointName: 'จุดระบายน้ำใหม่',
      },
    ]);

    expect(harness.writes.pointInserts).toEqual([]);
    expect(harness.writes.pointUpdates).toHaveLength(1);
    expect(pointUpdateFor(harness.writes, 21)?.values).toMatchObject({
      system_type: 'WPMS',
      point_code: 'W0099',
      point_name: 'จุดระบายน้ำใหม่',
      attachment_links_json: JSON.stringify([storedLink]),
    });
    expect(harness.writes.attachmentUpdates).toEqual([]);
  });

  it.each([
    {
      caseName: 'changed blank-code point',
      points: [
        makePointRow({
          id: 31,
          system_type: 'CEMS',
          point_code: null,
          point_name: 'จุดเดิม',
          attachment_links_json: JSON.stringify([
            { label: null, url: 'https://example.com/protected-blank' },
          ]),
        }),
      ],
      input: [{ systemType: 'CEMS' as const, pointCode: null, pointName: 'จุดที่แก้ชื่อ' }],
      protectedPointIds: [31],
    },
    {
      caseName: 'reordered duplicate point codes',
      points: [
        makePointRow({
          id: 32,
          system_type: 'CEMS',
          point_code: 'DUP',
          point_name: 'จุด A',
          attachment_links_json: JSON.stringify([
            { label: null, url: 'https://example.com/protected-duplicate' },
          ]),
        }),
        makePointRow({
          id: 33,
          system_type: 'CEMS',
          point_code: 'DUP',
          point_name: 'จุด B',
        }),
      ],
      input: [
        { systemType: 'CEMS' as const, pointCode: 'DUP', pointName: 'จุด B' },
        { systemType: 'CEMS' as const, pointCode: 'DUP', pointName: 'จุด A' },
      ],
      protectedPointIds: [32],
    },
  ])('rejects ambiguous legacy identity for $caseName before writing', async (testCase) => {
    const harness = createUpdateHarness({ points: testCase.points });

    await expect(updateForm(testCase.input)).rejects.toMatchObject({
      code: 'CONFLICT',
      details: { pointIds: testCase.protectedPointIds },
    });

    expect(harness.writes.formUpdates).toEqual([]);
    expect(harness.writes.pointUpdates).toEqual([]);
    expect(harness.writes.pointInserts).toEqual([]);
    expect(harness.writes.attachmentUpdates).toEqual([]);
  });

  it('does not let explicit empty resources on a new no-id point authorize ambiguous deletion', async () => {
    const harness = createUpdateHarness({
      points: [
        makePointRow({
          id: 34,
          system_type: 'CEMS',
          point_code: 'A',
          point_name: 'จุดเดิมที่มีเอกสาร',
          attachment_links_json: JSON.stringify([
            { label: null, url: 'https://example.com/protected' },
          ]),
        }),
        makePointRow({
          id: 35,
          system_type: 'CEMS',
          point_code: 'B',
          point_name: 'จุดเดิมที่คงไว้',
        }),
      ],
      attachments: [makeAttachmentRow({ id: 703, monitoring_point_id: 34 })],
    });

    await expect(
      updateForm([
        {
          systemType: 'CEMS',
          pointCode: 'B',
          pointName: 'จุดเดิมที่คงไว้',
        },
        {
          systemType: 'CEMS',
          pointCode: 'C',
          pointName: 'จุดใหม่',
          attachmentLinks: [],
          attachments: [],
        },
      ]),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      details: { pointIds: [34] },
    });

    expectNoWrites(harness.writes);
  });

  it('treats explicit empty resource arrays as an intentional clear', async () => {
    const harness = createUpdateHarness({
      points: [
        makePointRow({
          id: 41,
          system_type: 'CEMS',
          point_code: 'S0041',
          point_name: 'ปล่องที่ต้องล้างเอกสาร',
          attachment_links_json: JSON.stringify([
            { label: 'ลิงก์เดิม', url: 'https://example.com/remove-link' },
          ]),
        }),
      ],
      attachments: [makeAttachmentRow({ id: 701, monitoring_point_id: 41 })],
    });

    await updateForm([
      {
        id: 41,
        systemType: 'CEMS',
        pointCode: 'S0041',
        pointName: 'ปล่องที่ต้องล้างเอกสาร',
        attachmentLinks: [],
        attachments: [],
      },
    ]);

    expect(pointUpdateFor(harness.writes, 41)?.values).toMatchObject({
      attachment_links_json: '[]',
    });
    expect(harness.writes.attachmentUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filters: expect.arrayContaining([
            { kind: 'in', column: 'id', values: [701] },
            { kind: 'equal', column: 'monitoring_point_id', value: 41 },
          ]),
          values: expect.objectContaining({ deleted_at: expect.any(String) }),
        }),
      ]),
    );
  });

  it('treats an empty point list as intentional removal and soft-deletes its active attachments', async () => {
    const harness = createUpdateHarness({
      points: [
        makePointRow({
          id: 71,
          point_code: 'S0071',
          point_name: 'ปล่องที่จะลบ',
          attachment_links_json: JSON.stringify([
            { label: null, url: 'https://example.com/removed-point-link' },
          ]),
        }),
      ],
      attachments: [makeAttachmentRow({ id: 801, monitoring_point_id: 71 })],
    });

    await updateForm([]);

    expect(harness.writes.pointInserts).toEqual([]);
    expect(harness.writes.attachmentUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filters: expect.arrayContaining([
            { kind: 'in', column: 'monitoring_point_id', values: [71] },
          ]),
          values: expect.objectContaining({ deleted_at: expect.any(String) }),
        }),
      ]),
    );
    expect(harness.writes.pointUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filters: expect.arrayContaining([
            { kind: 'equal', column: 'form_id', value: 12 },
            { kind: 'in', column: 'id', values: [71] },
          ]),
          values: expect.objectContaining({ deleted_at: expect.any(String) }),
        }),
      ]),
    );
  });

  it('allows explicit ids to retain selected points while omitted resource-bearing points are removed', async () => {
    const harness = createUpdateHarness({
      points: [
        makePointRow({ id: 81, point_code: 'S0081', point_name: 'ปล่องที่คงไว้' }),
        makePointRow({
          id: 82,
          point_code: 'S0082',
          point_name: 'ปล่องที่ลบ',
          attachment_links_json: JSON.stringify([
            { label: null, url: 'https://example.com/omitted-point-link' },
          ]),
        }),
      ],
      attachments: [makeAttachmentRow({ id: 901, monitoring_point_id: 82 })],
    });

    await updateForm([
      { id: 81, systemType: 'CEMS', pointCode: 'S0081', pointName: 'ปล่องที่คงไว้' },
    ]);

    expect(pointUpdateFor(harness.writes, 81)?.values).not.toHaveProperty('deleted_at');
    expect(harness.writes.attachmentUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filters: expect.arrayContaining([
            { kind: 'in', column: 'monitoring_point_id', values: [82] },
          ]),
          values: expect.objectContaining({ deleted_at: expect.any(String) }),
        }),
      ]),
    );
    expect(harness.writes.pointUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filters: expect.arrayContaining([
            { kind: 'equal', column: 'form_id', value: 12 },
            { kind: 'in', column: 'id', values: [82] },
          ]),
          values: expect.objectContaining({ deleted_at: expect.any(String) }),
        }),
      ]),
    );
  });

  it('rejects an explicit point id that does not belong to the active form before writing', async () => {
    const harness = createUpdateHarness({
      points: [makePointRow({ id: 51, point_code: 'S0051', point_name: 'ปล่องเดิม' })],
    });

    await expect(
      updateForm([{ id: 999, systemType: 'CEMS', pointCode: 'S0999' }]),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      details: { pointId: 999, inputIndex: 0 },
    });

    expectNoWrites(harness.writes);
  });

  it('rejects duplicate explicit point ids before writing', async () => {
    const harness = createUpdateHarness({
      points: [makePointRow({ id: 61, point_code: 'S0061', point_name: 'ปล่องเดิม' })],
    });

    await expect(
      updateForm([
        { id: 61, systemType: 'CEMS', pointCode: 'S0061' },
        { id: 61, systemType: 'CEMS', pointCode: 'S0062' },
      ]),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      details: { pointId: 61, inputIndex: 1 },
    });

    expectNoWrites(harness.writes);
  });

  it('claims a pending upload owned by the actor in the form transaction', async () => {
    const uploadToken = 'A'.repeat(43);
    const harness = createUpdateHarness({
      points: [makePointRow({ id: 71, point_code: 'S0071' })],
      attachments: [
        makeAttachmentRow({
          id: 801,
          claim_token_hash: hashMonitoringPointAttachmentUploadToken(uploadToken),
          monitoring_point_id: null,
          sort_order: null,
          expires_at: '2999-01-01T00:00:00.000Z',
          claimed_at: null,
          created_by: 7,
        }),
      ],
    });

    await updateForm([
      {
        id: 71,
        systemType: 'CEMS',
        pointCode: 'S0071',
        attachments: [{ uploadToken }],
      },
    ]);

    expect(harness.writes.attachmentUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filters: expect.arrayContaining([
            { kind: 'equal', column: 'id', value: 801 },
            { kind: 'equal', column: 'created_by', value: 7 },
            { kind: 'null', column: 'monitoring_point_id' },
            { kind: 'null', column: 'claimed_at' },
          ]),
          values: expect.objectContaining({
            monitoring_point_id: 71,
            sort_order: 1,
            claimed_at: expect.any(String),
            updated_by: 7,
          }),
        }),
      ]),
    );
  });

  it('rejects an attachment id outside the target monitoring point', async () => {
    const harness = createUpdateHarness({
      points: [makePointRow({ id: 72, point_code: 'S0072' })],
      attachments: [makeAttachmentRow({ id: 802, monitoring_point_id: 999 })],
    });

    await expect(
      updateForm([
        {
          id: 72,
          systemType: 'CEMS',
          pointCode: 'S0072',
          attachments: [{ id: 802 }],
        },
      ]),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'Attachment id does not belong to the monitoring point',
      details: { attachmentId: 802, pointId: 72 },
    });

    expect(harness.writes.attachmentUpdates).toEqual([]);
  });

  it.each([
    {
      caseName: 'unknown token',
      attachment: null,
    },
    {
      caseName: 'token owned by another actor',
      attachment: { created_by: 8 },
    },
    {
      caseName: 'expired token',
      attachment: { expires_at: '2000-01-01T00:00:00.000Z' },
    },
    {
      caseName: 'replayed claimed token',
      attachment: {
        monitoring_point_id: 73,
        sort_order: 1,
        claimed_at: '2026-08-11T11:00:00.000Z',
      },
    },
  ])('rejects an unavailable upload token: $caseName', async ({ attachment }) => {
    const uploadToken = 'B'.repeat(43);
    const harness = createUpdateHarness({
      points: [makePointRow({ id: 73, point_code: 'S0073' })],
      attachments: attachment
        ? [
            makeAttachmentRow({
              id: 803,
              claim_token_hash: hashMonitoringPointAttachmentUploadToken(uploadToken),
              monitoring_point_id: null,
              sort_order: null,
              expires_at: '2999-01-01T00:00:00.000Z',
              claimed_at: null,
              created_by: 7,
              ...attachment,
            }),
          ]
        : [],
    });

    await expect(
      updateForm([
        {
          id: 73,
          systemType: 'CEMS',
          pointCode: 'S0073',
          attachments: [{ uploadToken }],
        },
      ]),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'Attachment upload token is invalid or unavailable',
    });

    expect(
      harness.writes.attachmentUpdates.filter((update) => update.values.monitoring_point_id === 73),
    ).toEqual([]);
  });

  it('rejects a duplicate attachment reference across monitoring points', async () => {
    const uploadToken = 'C'.repeat(43);
    const harness = createUpdateHarness({
      points: [
        makePointRow({ id: 74, point_code: 'S0074' }),
        makePointRow({ id: 75, point_code: 'S0075' }),
      ],
    });

    await expect(
      updateForm([
        {
          id: 74,
          systemType: 'CEMS',
          pointCode: 'S0074',
          attachments: [{ uploadToken }],
        },
        {
          id: 75,
          systemType: 'CEMS',
          pointCode: 'S0075',
          attachments: [{ uploadToken }],
        },
      ]),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Duplicate attachment reference in request',
    });

    expect(harness.writes.attachmentUpdates).toEqual([]);
  });
});

async function updateForm(points: MonitoringPointInput[]) {
  return monitoringPointFormsRepository.update(12, { factory: {}, points }, 7);
}

function createUpdateHarness(options: HarnessOptions): { writes: HarnessWrites } {
  const formRows: StoredRow[] = [{ id: 12, deleted_at: null }];
  const pointRows = options.points.map((row) => ({ deleted_at: null, ...row }));
  const attachmentRows = (options.attachments ?? []).map((row) => ({ deleted_at: null, ...row }));
  const writes: HarnessWrites = {
    formUpdates: [],
    pointUpdates: [],
    pointInserts: [],
    attachmentUpdates: [],
  };
  let nextPointId = 10_000;

  const trx = jest.fn((tableName: string) =>
    createQueryBuilder({
      tableName,
      formRows,
      pointRows,
      attachmentRows,
      writes,
      nextPointId: () => nextPointId++,
    }),
  );
  Object.assign(trx, {
    fn: {
      now: jest.fn(() => '2026-08-11T12:00:00.000Z'),
    },
  });
  Object.assign(mockDb, {
    transaction: jest.fn((callback: (transaction: typeof trx) => unknown) => callback(trx)),
  });

  jest.spyOn(monitoringPointFormsRepository, 'findById').mockResolvedValue({
    id: 12,
    factory: {},
    points: [],
    createdAt: '2026-08-11T00:00:00.000Z',
    updatedAt: '2026-08-11T12:00:00.000Z',
  } as never);

  return { writes };
}

function createQueryBuilder(context: {
  tableName: string;
  formRows: StoredRow[];
  pointRows: StoredRow[];
  attachmentRows: StoredRow[];
  writes: HarnessWrites;
  nextPointId: () => number;
}): QueryBuilderMock {
  const filters: Filter[] = [];
  let pendingInsert: StoredRow | null = null;
  const query = {} as QueryBuilderMock;

  query.where = ((column: string, operatorOrValue: unknown, maybeValue?: unknown) => {
    if (maybeValue !== undefined) {
      filters.push({
        kind: 'compare',
        column: normalizeColumn(column),
        operator: String(operatorOrValue),
        value: maybeValue,
      });
    } else {
      filters.push({
        kind: 'equal',
        column: normalizeColumn(column),
        value: operatorOrValue,
      });
    }
    return query;
  }) as QueryBuilderMock['where'];
  query.whereNull = (column) => {
    filters.push({ kind: 'null', column: normalizeColumn(column) });
    return query;
  };
  query.whereNotNull = (column) => {
    filters.push({ kind: 'not-null', column: normalizeColumn(column) });
    return query;
  };
  query.whereIn = (column, values) => {
    filters.push({ kind: 'in', column: normalizeColumn(column), values: [...values] });
    return query;
  };
  query.orderBy = () => query;
  query.forUpdate = () => query;
  query.select = () => query;
  query.first = async () => rowsForTable(context).filter((row) => matches(row, filters))[0];
  query.update = async (values) => {
    const matchingRows = rowsForTable(context).filter((row) => matches(row, filters));
    const captured = { filters: [...filters], values: { ...values } };
    if (isFormsTable(context.tableName)) context.writes.formUpdates.push(captured);
    if (context.tableName === 'factory_monitoring_points') {
      context.writes.pointUpdates.push(captured);
    }
    if (context.tableName === 'factory_monitoring_point_attachments') {
      context.writes.attachmentUpdates.push(captured);
    }
    matchingRows.forEach((row) => Object.assign(row, values));
    return matchingRows.length;
  };
  query.insert = (values) => {
    pendingInsert = { ...values };
    return query;
  };
  query.returning = async () => {
    if (!pendingInsert) return [];
    const id = context.nextPointId();
    const inserted = { id, deleted_at: null, ...pendingInsert };
    context.pointRows.push(inserted);
    context.writes.pointInserts.push({ ...inserted });
    return [{ id }];
  };
  query.then = (onFulfilled, onRejected) =>
    Promise.resolve(rowsForTable(context).filter((row) => matches(row, filters))).then(
      onFulfilled,
      onRejected,
    );

  return query;
}

function rowsForTable(context: {
  tableName: string;
  formRows: StoredRow[];
  pointRows: StoredRow[];
  attachmentRows: StoredRow[];
}): StoredRow[] {
  if (isFormsTable(context.tableName)) return context.formRows;
  if (context.tableName === 'factory_monitoring_points') return context.pointRows;
  if (context.tableName === 'factory_monitoring_point_attachments') return context.attachmentRows;
  throw new Error(`Unexpected table in reconciliation harness: ${context.tableName}`);
}

function isFormsTable(tableName: string): boolean {
  return tableName === 'factory_monitoring_point_forms';
}

function matches(row: StoredRow, filters: Filter[]): boolean {
  return filters.every((filter) => {
    const actual = row[filter.column];
    switch (filter.kind) {
      case 'equal':
        return valuesEqual(actual, filter.value);
      case 'compare':
        if (filter.operator === '>') {
          return new Date(String(actual)).getTime() > new Date(String(filter.value)).getTime();
        }
        throw new Error(
          `Unsupported comparison operator in reconciliation harness: ${filter.operator}`,
        );
      case 'in':
        return filter.values.some((value) => valuesEqual(actual, value));
      case 'null':
        return actual === null || actual === undefined;
      case 'not-null':
        return actual !== null && actual !== undefined;
    }
  });
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Buffer.isBuffer(left) && Buffer.isBuffer(right)) return left.equals(right);
  return left === right;
}

function normalizeColumn(column: string): string {
  return column.includes('.') ? (column.split('.').pop() ?? column) : column;
}

function makePointRow(overrides: StoredRow): StoredRow {
  return {
    id: 1,
    form_id: 12,
    system_type: 'CEMS',
    point_code: null,
    point_name: null,
    attachment_links_json: '[]',
    details_json: null,
    ...overrides,
  };
}

function makeAttachmentRow(overrides: StoredRow): StoredRow {
  return {
    id: 1,
    public_id: 'public-attachment-id',
    claim_token_hash: Buffer.alloc(32, 1),
    monitoring_point_id: null,
    original_file_name: 'document.pdf',
    mime_type: 'application/pdf',
    file_size: 1024,
    storage_path: 'monitoring-point-forms/attachments/document.pdf',
    sort_order: 1,
    expires_at: '2026-08-12T12:00:00.000Z',
    claimed_at: '2026-08-11T11:00:00.000Z',
    created_at: '2026-08-11T10:00:00.000Z',
    updated_at: '2026-08-11T11:00:00.000Z',
    created_by: 7,
    updated_by: 7,
    deleted_at: null,
    ...overrides,
  };
}

function pointUpdateFor(writes: HarnessWrites, pointId: number): CapturedUpdate | undefined {
  return writes.pointUpdates.find((update) =>
    update.filters.some(
      (filter) => filter.kind === 'equal' && filter.column === 'id' && filter.value === pointId,
    ),
  );
}

function expectNoWrites(writes: HarnessWrites): void {
  expect(writes.formUpdates).toEqual([]);
  expect(writes.pointUpdates).toEqual([]);
  expect(writes.pointInserts).toEqual([]);
  expect(writes.attachmentUpdates).toEqual([]);
}
