import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { db } from '../../src/config/database';
import { pomsFactoriesRepository } from '../../src/modules/poms-factories/poms-factories.repository';
import { pomsFactoriesService } from '../../src/modules/poms-factories/poms-factories.service';

type Query = { toSQL(): { sql: string; bindings: unknown[]; method: string } };

afterEach(() => {
  jest.restoreAllMocks();
});

function requestRow() {
  const profile = { eligibleFactoryId: 7, factoryId: 'factory-001', factoryName: 'Test factory' };
  const wpms = {
    connectedPointId: 10024,
    systemType: 'WPMS',
    pointCode: 'P0155',
    pointName: 'Water',
    parameters: [],
  };
  const cems = {
    connectedPointId: 10021,
    systemType: 'CEMS',
    pointCode: 'S0915',
    pointName: 'Unit 4500 (Waste Gas)',
    parameters: [],
  };
  return {
    id: 48,
    request_no: 'point-00024/2569',
    eligible_factory_id: 7,
    factory_id: profile.factoryId,
    factory_name: profile.factoryName,
    factory_registration_no: 'old-001',
    province_name: 'Test province',
    form_type: 'MEASUREMENT_POINTS',
    status: 'PENDING_REVIEW',
    revision_no: 0,
    is_open: 1,
    current_factory_json: JSON.stringify(profile),
    proposed_factory_json: JSON.stringify(profile),
    current_measurement_points_json: JSON.stringify([wpms, cems]),
    proposed_measurement_points_json: JSON.stringify([
      wpms,
      { ...cems, pointName: 'Edited stack' },
    ]),
    submitted_by: 42,
    created_by: 42,
    submitted_at: '2026-09-18T00:00:00.000Z',
    created_at: '2026-09-18T00:00:00.000Z',
    updated_at: '2026-09-18T00:00:00.000Z',
  };
}

function mockRows(rows: object[]) {
  const queries: ReturnType<Query['toSQL']>[] = [];
  jest.spyOn(db.client, 'runner').mockImplementation(((query: Query) => ({
    run: async () => {
      const compiled = query.toSQL();
      queries.push(compiled);
      if (compiled.sql.includes('[poms_factory_edit_request_events]')) return [];
      return compiled.method === 'first' ? rows[0] : rows;
    },
  })) as never);
  return queries;
}

describe('POMS edit-request list summary', () => {
  it('reports CEMS S0915 for the changed target even when an unchanged WPMS point is first', async () => {
    const queries = mockRows([requestRow()]);
    const result = await pomsFactoriesRepository.listEditRequests(
      {},
      { actorUserId: 42, scope: 'ALL' },
    );
    expect(result[0]).toMatchObject({
      id: 48,
      targetMeasurementPoints: [
        {
          connectedPointId: 10021,
          systemType: 'CEMS',
          pointCode: 'S0915',
          pointName: 'Edited stack',
        },
      ],
    });
    for (const field of [
      'currentFactory',
      'proposedFactory',
      'currentMeasurementPoints',
      'proposedMeasurementPoints',
      'currentContacts',
      'proposedContacts',
      'events',
    ]) {
      expect(result[0]).not.toHaveProperty(field);
    }
    expect(queries).toHaveLength(1);
  });
  it('preserves all submitted IDs including unchanged points and input order', async () => {
    const row = requestRow();
    const proposed = JSON.parse(row.proposed_measurement_points_json);
    proposed[0].pointName = proposed[1].pointName;
    proposed[0].pointCode = null;
    mockRows([
      {
        ...row,
        proposed_measurement_points_json: JSON.stringify(proposed),
        target_measurement_point_ids_json: '[10021,10024]',
      },
    ]);
    const [result] = await pomsFactoriesRepository.listEditRequests(
      {},
      { actorUserId: 42, scope: 'ALL' },
    );
    expect(result.targetMeasurementPoints.map((point) => point.connectedPointId)).toEqual([
      10021, 10024,
    ]);
    expect(result.targetMeasurementPoints[1].pointCode).toBeNull();
    expect(result.targetMeasurementPointsSource).toBe('SUBMITTED');
  });

  it('identifies a submitted unchanged point for a root contact-only edit', async () => {
    const row = requestRow();
    mockRows([
      {
        ...row,
        proposed_measurement_points_json: row.current_measurement_points_json,
        target_measurement_point_ids_json: '[10021]',
        current_contacts_json: '{"systemType":"CEMS","notificationEmails":[]}',
        proposed_contacts_json: '{"systemType":"CEMS","notificationEmails":["new@example.com"]}',
      },
    ]);
    const [result] = await pomsFactoriesRepository.listEditRequests(
      {},
      { actorUserId: 42, scope: 'ALL' },
    );
    expect(result.targetMeasurementPoints.map((point) => point.connectedPointId)).toEqual([10021]);
    expect(result.targetMeasurementPointsSource).toBe('SUBMITTED');
  });

  it.each([null, '[]', '[99999]', '[10021,10021]', 'invalid', '["10021"]'])(
    'does not invent targets when unchanged legacy snapshots or invalid stored IDs (%s) lack evidence',
    async (ids) => {
      const row = requestRow();
      mockRows([
        {
          ...row,
          proposed_measurement_points_json: row.current_measurement_points_json,
          target_measurement_point_ids_json: ids,
        },
      ]);
      const [result] = await pomsFactoriesRepository.listEditRequests(
        {},
        { actorUserId: 42, scope: 'ALL' },
      );
      expect(result.targetMeasurementPoints).toEqual([]);
      expect(result.targetMeasurementPointsSource).toBe('UNKNOWN');
    },
  );

  it('does not infer target IDs from legacy root email fan-out', async () => {
    const row = requestRow();
    const before = JSON.parse(row.current_measurement_points_json);
    const after = before.map((point: object) => ({
      ...point,
      officerNotificationEmails: ['new@example.com'],
    }));
    mockRows([
      {
        ...row,
        proposed_measurement_points_json: JSON.stringify(after),
        current_contacts_json: '{"systemType":"CEMS","officerNotificationEmails":[]}',
        proposed_contacts_json:
          '{"systemType":"CEMS","officerNotificationEmails":["new@example.com"]}',
      },
    ]);
    const [result] = await pomsFactoriesRepository.listEditRequests(
      {},
      { actorUserId: 42, scope: 'ALL' },
    );
    expect(result.targetMeasurementPoints).toEqual([]);
    expect(result.targetMeasurementPointsSource).toBe('UNKNOWN');
  });

  it('matches legacy points by ID after snapshots are reordered', async () => {
    const row = requestRow();
    mockRows([
      {
        ...row,
        proposed_measurement_points_json: JSON.stringify(
          JSON.parse(row.proposed_measurement_points_json).reverse(),
        ),
      },
    ]);
    const [result] = await pomsFactoriesRepository.listEditRequests(
      {},
      { actorUserId: 42, scope: 'ALL' },
    );
    expect(result.targetMeasurementPoints.map((point) => point.connectedPointId)).toEqual([10021]);
    expect(result.targetMeasurementPointsSource).toBe('SNAPSHOT_DIFF');
  });

  it('returns no targets for BASIC_INFO even if old snapshots contain points', async () => {
    mockRows([
      { ...requestRow(), form_type: 'BASIC_INFO', target_measurement_point_ids_json: '[10021]' },
    ]);
    const [result] = await pomsFactoriesRepository.listEditRequests(
      {},
      { actorUserId: 42, scope: 'ALL' },
    );
    expect(result.targetMeasurementPoints).toEqual([]);
    expect(result.targetMeasurementPointsSource).toBe('NOT_APPLICABLE');
  });

  it('keeps filtering, newest-first sorting and assigned-factory scope in one query', async () => {
    const queries = mockRows([requestRow()]);
    const [result] = await pomsFactoriesRepository.listEditRequests(
      { status: 'PENDING_REVIEW', factoryId: 'factory-001', search: 'point-' },
      { actorUserId: 42, scope: 'OWN_FACTORY' },
    );
    expect(result.provinceName).toBe('Test province');
    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain('[req].[status] = ?');
    expect(queries[0].sql).toContain('[req].[factory_id] = ?');
    expect(queries[0].sql).toContain('[req].[request_no] like ?');
    expect(queries[0].sql).toContain('order by [req].[created_at] desc, [req].[id] desc');
    expect(queries[0].bindings).toEqual(
      expect.arrayContaining([42, 'PENDING_REVIEW', 'factory-001', '%point-%']),
    );
    expect(queries[0].sql).not.toContain('[req].*');
    expect(queries[0].sql).not.toContain('[req].[proposed_factory_json]');
  });
  it('returns UNKNOWN for malformed legacy document metadata without failing the entire list', async () => {
    const row = requestRow();
    const proposed = JSON.parse(row.proposed_measurement_points_json);
    proposed[0].documentsAndImages = 'invalid';
    mockRows([{ ...row, proposed_measurement_points_json: JSON.stringify(proposed) }]);
    const [result] = await pomsFactoriesRepository.listEditRequests(
      {},
      { actorUserId: 42, scope: 'ALL' },
    );
    expect(result.targetMeasurementPointsSource).toBe('UNKNOWN');
    expect(result.targetMeasurementPoints).toEqual([]);
  });

  it('does not infer targets when only factory photos change', async () => {
    const row = requestRow();
    const proposed = JSON.parse(row.current_measurement_points_json).map((point: object) => ({
      ...point,
      documentsAndImages: [
        { title: 'ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน', fileUrl: 'https://example.com/photo.jpg' },
      ],
    }));
    mockRows([{ ...row, proposed_measurement_points_json: JSON.stringify(proposed) }]);
    const [result] = await pomsFactoriesRepository.listEditRequests(
      {},
      { actorUserId: 42, scope: 'ALL' },
    );
    expect(result.targetMeasurementPointsSource).toBe('UNKNOWN');
  });
});

describe('POMS edit-request detail selected points', () => {
  function mockDetail(row: object) {
    jest.spyOn(pomsFactoriesRepository, 'findFactoryFormContacts').mockResolvedValue(null);
    return mockRows([row]);
  }

  it.each(['WPMS', 'CEMS'])(
    'omits an unrequested %s point from both before/after snapshots for request 48',
    async (systemType) => {
      const row = requestRow();
      const current = JSON.parse(row.current_measurement_points_json);
      const proposed = JSON.parse(row.proposed_measurement_points_json);
      current[0].systemType = proposed[0].systemType = systemType;
      mockDetail({
        ...row,
        current_measurement_points_json: JSON.stringify(current),
        proposed_measurement_points_json: JSON.stringify(proposed),
        target_measurement_point_ids_json: '[10021]',
      });

      const result = await pomsFactoriesService.getEditRequest(48, 42, 'ALL', null);

      expect(result.id).toBe(48);
      expect(result.currentMeasurementPoints).toEqual([
        expect.objectContaining({
          connectedPointId: 10021,
          systemType: 'CEMS',
          pointCode: 'S0915',
        }),
      ]);
      expect(result.proposedMeasurementPoints).toEqual([
        expect.objectContaining({ connectedPointId: 10021, pointName: 'Edited stack' }),
      ]);
      // Other consumers still need the complete stored snapshots.
      const stored = await pomsFactoriesRepository.findEditRequestById(48, {
        actorUserId: 42,
        scope: 'ALL',
      });
      expect(stored?.currentMeasurementPoints).toHaveLength(2);
      expect(stored?.proposedMeasurementPoints).toHaveLength(2);
    },
  );

  it.each(['PENDING_REVIEW', 'APPROVED', 'REJECTED'])(
    'infers only the changed legacy point by ID in status %s even after reordering',
    async (status) => {
      const row = requestRow();
      mockDetail({
        ...row,
        status,
        proposed_measurement_points_json: JSON.stringify(
          JSON.parse(row.proposed_measurement_points_json).reverse(),
        ),
        target_measurement_point_ids_json: null,
      });
      const result = await pomsFactoriesService.getEditRequest(48, 42, 'ALL', null);
      expect(result.currentMeasurementPoints?.map((point) => point.connectedPointId)).toEqual([
        10021,
      ]);
      expect(result.proposedMeasurementPoints?.map((point) => point.connectedPointId)).toEqual([
        10021,
      ]);
    },
  );

  it('keeps explicitly selected unchanged points for a contact-only edit', async () => {
    const row = requestRow();
    mockDetail({
      ...row,
      proposed_measurement_points_json: row.current_measurement_points_json,
      target_measurement_point_ids_json: '[10021]',
      current_contacts_json: JSON.stringify({
        systemType: 'CEMS',
        contactPersons: [],
        notificationEmails: [],
        officerNotificationEmails: [],
      }),
      proposed_contacts_json: JSON.stringify({
        systemType: 'CEMS',
        contactPersons: [],
        notificationEmails: ['new@example.com'],
        officerNotificationEmails: [],
      }),
    });
    const result = await pomsFactoriesService.getEditRequest(48, 42, 'ALL', null);
    expect(result.currentMeasurementPoints?.map((point) => point.connectedPointId)).toEqual([
      10021,
    ]);
    expect(result.proposedMeasurementPoints?.map((point) => point.connectedPointId)).toEqual([
      10021,
    ]);
    expect(result.notificationEmails).toEqual(['new@example.com']);
  });

  it('keeps all explicitly selected points across systems', async () => {
    mockDetail({ ...requestRow(), target_measurement_point_ids_json: '[10021,10024]' });
    const result = await pomsFactoriesService.getEditRequest(48, 42, 'ALL', null);
    expect(result.currentMeasurementPoints?.map((point) => point.connectedPointId)).toEqual([
      10024, 10021,
    ]);
    expect(result.proposedMeasurementPoints?.map((point) => point.connectedPointId)).toEqual([
      10024, 10021,
    ]);
  });

  it.each([null, '[]', '[99999]', 'invalid'])(
    'does not present all points as selected when target evidence is unknown (%s)',
    async (ids) => {
      const row = requestRow();
      mockDetail({
        ...row,
        target_measurement_point_ids_json: ids,
        proposed_measurement_points_json: row.current_measurement_points_json,
      });
      const result = await pomsFactoriesService.getEditRequest(48, 42, 'ALL', null);
      expect(result.currentMeasurementPoints).toEqual([]);
      expect(result.proposedMeasurementPoints).toEqual([]);
    },
  );

  it('preserves null measurement snapshots for BASIC_INFO', async () => {
    mockDetail({
      ...requestRow(),
      form_type: 'BASIC_INFO',
      current_measurement_points_json: null,
      proposed_measurement_points_json: null,
    });
    const result = await pomsFactoriesService.getEditRequest(48, 42, 'ALL', null);
    expect(result.currentMeasurementPoints).toBeNull();
    expect(result.proposedMeasurementPoints).toBeNull();
  });

  it('preserves data scope and returns 404 before reading contacts for inaccessible requests', async () => {
    const contacts = jest
      .spyOn(pomsFactoriesRepository, 'findFactoryFormContacts')
      .mockResolvedValue(null);
    const queries = mockRows([]);
    await expect(
      pomsFactoriesService.getEditRequest(48, 42, 'OWN_FACTORY', null),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(contacts).not.toHaveBeenCalled();
    expect(queries).toHaveLength(1);
    expect(queries[0].bindings).toEqual(expect.arrayContaining([42, 48]));
    expect(queries[0].sql).toContain('[req].[id] = ?');
  });
});
