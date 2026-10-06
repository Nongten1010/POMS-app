import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { db } from '../../src/config/database';
import { env } from '../../src/config/env';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';
import { connectionRequestsService } from '../../src/modules/connection-requests/connection-requests.service';
import { deviceConnectionsService } from '../../src/modules/device-connections/device-connections.service';

const factoryId = '91120225825674';
const oldRegistrationNo = 'ข3-59-7/67ปจ';
const previousMode = env.FACTORY_PROFILE_MODE;
type Query = { toSQL(): { sql: string; bindings: unknown[] } };
const legacyEligibleRow = {
  id: 940,
  eligible_factory_id: 940,
  source_system: 'diw.fac_import',
  source_factory_id: factoryId,
  factory_registration_no_new: oldRegistrationNo,
  factory_registration_no_old: null,
  factory_name: 'บริษัท เชาว์ สตีล แมนูแฟคเจอริ่ง จำกัด',
};
const factoryRow = {
  ...legacyEligibleRow,
  id: 52,
  fid: factoryId,
  code: oldRegistrationNo,
  name: legacyEligibleRow.factory_name,
  factory_type_sequence: '00059',
  system_detail: null,
  province_id: null,
  province_region: null,
  province_name: 'ปราจีนบุรี',
  industrial_estate_code: null,
  industrial_estate_name: null,
  is_active: true,
  address: null,
  latitude: null,
  longitude: null,
  business_activity: null,
  eia_assessment: null,
  eia_other: null,
  has_eia: null,
  project_name: null,
  authorize_start: null,
  authorize_end: null,
};

describe('factory registration identity at request and eligibility seams', () => {
  let queries: Array<{ sql: string; bindings: unknown[] }>;

  function returnRows(result: unknown) {
    jest.spyOn(db.client, 'runner').mockImplementation(((query: Query) => ({
      run: async () => {
        queries.push(query.toSQL());
        return result;
      },
    })) as never);
  }

  beforeEach(() => {
    env.FACTORY_PROFILE_MODE = 'legacy';
    queries = [];
  });

  afterEach(() => {
    env.FACTORY_PROFILE_MODE = previousMode;
    jest.restoreAllMocks();
  });

  it('preserves the new DIW identity when a legacy eligible row has its old registration in the new column', async () => {
    returnRows(legacyEligibleRow);
    const result = await connectionRequestsRepository.findDirectConnectionFactory(
      { factoryId, factoryRegistrationNo: oldRegistrationNo },
      { actorUserId: 42, scope: 'ALL' },
    );
    expect(result).toMatchObject({
      factoryId,
      newRegistrationNo: factoryId,
      oldRegistrationNo,
      eligibleFactoryId: 940,
    });
    expect(queries[0].sql).toContain('[ef].[source_factory_id]');
    expect(queries[0].sql).toContain('[ef].[source_system]');
  });

  it.each([false, true])(
    'writes the real revision-workflow request with the new factory ID and the old display registration (repaired=%s)',
    async (repaired) => {
      returnRows(
        repaired
          ? {
              ...legacyEligibleRow,
              factory_registration_no_new: factoryId,
              factory_registration_no_old: oldRegistrationNo,
            }
          : legacyEligibleRow,
      );
      const create = jest
        .spyOn(connectionRequestsRepository, 'create')
        .mockResolvedValue({} as never);
      await connectionRequestsService.createMeasurementPointRequest(
        {
          factoryId,
          factoryName: legacyEligibleRow.factory_name,
          factoryRegistrationNo: oldRegistrationNo,
          systemType: 'CEMS',
          measurementPoints: [],
          submissionAction: 'REQUEST_FACTORY_REVISION',
          revisionReason: 'ข้อมูลจุดตรวจวัดยังไม่ครบ',
        } as never,
        {
          actorUserId: 42,
          userType: 'officer',
          roles: ['monitoring_kpm'],
          editScope: 'ALL',
        },
      );
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ factoryId, factoryRegistrationNo: oldRegistrationNo }),
        42,
        'WAITING_FACTORY_REVISION',
        expect.any(Object),
      );
    },
  );

  it('keeps the old registration when connecting from the add-point form after data repair', async () => {
    returnRows({
      ...legacyEligibleRow,
      factory_registration_no_new: factoryId,
      factory_registration_no_old: oldRegistrationNo,
    });
    const create = jest
      .spyOn(connectionRequestsRepository, 'createDirectConnection')
      .mockResolvedValue({} as never);
    await connectionRequestsService.createMeasurementPointRequest(
      {
        factoryId,
        factoryName: legacyEligibleRow.factory_name,
        factoryRegistrationNo: oldRegistrationNo,
        systemType: 'CEMS',
        measurementPoints: [{ pointCode: 'S0609', pointName: 'ปล่อง 1', systemType: 'CEMS' }],
        submissionAction: 'CONNECT',
      } as never,
      {
        actorUserId: 42,
        userType: 'officer',
        roles: ['monitoring_kpm'],
        directConnectScope: 'ALL',
      },
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ factoryId, factoryRegistrationNo: oldRegistrationNo }),
      42,
    );
  });

  it.each(['create', 'createMeasurementPointRequest'] as const)(
    'canonicalizes an old factory alias before normal %s persistence',
    async (method) => {
      returnRows({
        ...legacyEligibleRow,
        factory_registration_no_new: factoryId,
        factory_registration_no_old: oldRegistrationNo,
      });
      const create = jest
        .spyOn(connectionRequestsRepository, 'create')
        .mockResolvedValue({} as never);
      await connectionRequestsService[method](
        {
          factoryId: oldRegistrationNo,
          factoryName: legacyEligibleRow.factory_name,
          factoryRegistrationNo: oldRegistrationNo,
          systemType: 'CEMS',
          measurementPoints: [],
        } as never,
        42,
      );
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ factoryId, factoryRegistrationNo: oldRegistrationNo }),
        42,
        'PENDING_DESIGN_REVIEW',
      );
    },
  );

  it('preserves immutable registration snapshots when resubmitting after the eligible display registration changes', async () => {
    returnRows({
      ...legacyEligibleRow,
      factory_registration_no_new: factoryId,
      factory_registration_no_old: oldRegistrationNo,
    });
    const updatedAt = '2026-10-06T01:00:00.000Z';
    jest.spyOn(connectionRequestsRepository, 'findById').mockResolvedValue({
      id: 10043,
      factoryId,
      factoryRegistrationNo: factoryId,
      systemType: 'CEMS',
      requestType: 'NEW_CONNECTION',
      status: 'WAITING_FACTORY_REVISION',
      updatedAt,
    } as never);
    jest.spyOn(connectionRequestsRepository, 'canEditRequest').mockResolvedValue(true);
    const replace = jest
      .spyOn(connectionRequestsRepository, 'replaceForm')
      .mockResolvedValue({} as never);
    await connectionRequestsService.resubmit(
      10043,
      {
        factoryId,
        factoryName: legacyEligibleRow.factory_name,
        factoryRegistrationNo: factoryId,
        systemType: 'CEMS',
        eia: 'ไม่มี',
        contactName: 'ผู้ประสานงาน',
        contactPhone: '0812345678',
        measurementPoints: [{ pointName: 'ปล่อง A', pointType: 'STACK' }],
      } as never,
      42,
      'OWN_FACTORY',
    );
    expect(replace).toHaveBeenCalledWith(
      10043,
      expect.objectContaining({
        factoryId,
        factoryRegistrationNo: factoryId,
        eligibleFactoryId: 940,
      }),
      42,
      'REVISED_PENDING_DESIGN_REVIEW',
      expect.objectContaining({ expectedUpdatedAt: updatedAt }),
    );
  });

  it('requires the submitted factory ID even when its display registration names a different factory', async () => {
    returnRows(legacyEligibleRow);
    await connectionRequestsRepository.findDirectConnectionFactory(
      { factoryId, factoryRegistrationNo: 'ข3-59-6/67ปจ' },
      { actorUserId: 42, scope: 'ALL' },
    );
    expect(queries[0].sql).toMatch(
      /and \(\[ef\]\.\[source_factory_id\] = \? or \[ef\]\.\[factory_registration_no_new\] = \? or \[ef\]\.\[factory_registration_no_old\] = \?\)/,
    );
    expect(queries[0].bindings.slice(-3)).toEqual([factoryId, factoryId, factoryId]);
  });

  it.each(['legacy', 'canonical'] as const)(
    'keeps old and new registrations separate in accessible summaries in %s mode',
    async (mode) => {
      env.FACTORY_PROFILE_MODE = mode;
      returnRows([factoryRow]);
      const rows = await connectionRequestsRepository.listFactoriesForAccess({
        actorUserId: 42,
        scope: 'ALL',
      });
      expect(rows[0]).toMatchObject({ factoryId, newRegistrationNo: factoryId, oldRegistrationNo });
    },
  );

  it('keeps the master registration out of a new eligibility-request snapshot', async () => {
    returnRows({
      ...factoryRow,
      eligible_factory_id: null,
      source_factory_id: null,
      source_system: null,
      factory_registration_no_new: null,
    });
    const factory = await connectionRequestsRepository.findFactorySummaryForAccess(factoryId, {
      actorUserId: 42,
      scope: 'OWN_FACTORY',
    });
    expect(factory).toMatchObject({ factoryId, newRegistrationNo: factoryId, oldRegistrationNo });
  });

  it('uses new identity and old display registration in general form defaults', async () => {
    returnRows(factoryRow);
    const factory = await connectionRequestsRepository.findFactoryGeneral(factoryId, {
      actorUserId: 42,
      scope: 'ALL',
    });
    expect(factory).toMatchObject({
      factoryId,
      newRegistrationNo: factoryId,
      oldRegistrationNo,
      formDefaults: { factoryId, factoryRegistrationNo: oldRegistrationNo },
    });
  });

  it.each(['legacy', 'canonical'] as const)(
    'joins repaired eligible registrations by stable identity in general lookup in %s mode',
    async (mode) => {
      env.FACTORY_PROFILE_MODE = mode;
      returnRows({
        ...factoryRow,
        factory_registration_no_new: factoryId,
        factory_registration_no_old: oldRegistrationNo,
      });
      await connectionRequestsRepository.findFactoryGeneral(factoryId, {
        actorUserId: 42,
        scope: 'ALL',
      });
      expect(queries[0].sql).toContain('[f].[fid] = [ef].[factory_registration_no_new]');
      expect(queries[0].sql).toContain('[f].[fid] = [ef].[source_factory_id]');
      expect(queries[0].sql).toContain('[ef].[deleted_at] is null');
    },
  );

  it('retains separate registrations in request details when no supporting factory master exists', async () => {
    jest.spyOn(connectionRequestsRepository, 'list').mockResolvedValue({
      rows: [
        {
          id: 10043,
          factoryId,
          factoryName: legacyEligibleRow.factory_name,
          factoryRegistrationNo: oldRegistrationNo,
          industryMainOrder: null,
          industrySubOrder: null,
          businessActivity: null,
          hasEia: false,
          projectName: null,
          address: null,
          latitude: null,
          longitude: null,
        } as never,
      ],
      total: 1,
    });
    jest
      .spyOn(connectionRequestsRepository, 'findFactorySummariesForRequests')
      .mockResolvedValue(new Map());
    jest.spyOn(deviceConnectionsService, 'listByRequestId').mockResolvedValue([]);
    const details = await connectionRequestsService.listDetails({}, 42, 'ALL');
    expect(details.data[0].factory).toMatchObject({
      factoryId,
      newRegistrationNo: factoryId,
      oldRegistrationNo,
    });
  });

  it('corrects legacy registration fields on the active eligible reference used by request forms', async () => {
    returnRows(legacyEligibleRow);
    const reference = await connectionRequestsRepository.findActiveEligibleFactoryReference({
      factoryId,
      factoryRegistrationNo: oldRegistrationNo,
    });
    expect(reference).toMatchObject({
      sourceFactoryId: factoryId,
      factoryRegistrationNoNew: factoryId,
      factoryRegistrationNoOld: oldRegistrationNo,
    });
  });

  it('keeps canonical new registration when an unrelated source alias is present', async () => {
    returnRows({
      ...legacyEligibleRow,
      source_factory_id: '91120225425673',
      factory_registration_no_new: factoryId,
      factory_registration_no_old: oldRegistrationNo,
    });
    const factory = await connectionRequestsRepository.findDirectConnectionFactory(
      { factoryId, factoryRegistrationNo: oldRegistrationNo },
      { actorUserId: 42, scope: 'ALL' },
    );
    expect(factory).toMatchObject({ factoryId, newRegistrationNo: factoryId, oldRegistrationNo });
  });

  it('reads a connected factory without a master row using its source identity', async () => {
    returnRows([{ ...factoryRow, id: null }]);
    const factories = await connectionRequestsRepository.listFactoriesForAccess({
      actorUserId: 42,
      scope: 'ALL',
      connectedPomsOnly: true,
    });
    expect(factories[0]).toMatchObject({
      id: null,
      factoryId,
      newRegistrationNo: factoryId,
      oldRegistrationNo,
    });
    expect(queries[0].sql).toContain(
      'COALESCE(ef.source_factory_id, f.fid, ef.factory_registration_no_new) as fid',
    );
  });

  it('preserves explicitly stored registrations for non-DIW identities', async () => {
    returnRows({
      ...legacyEligibleRow,
      source_system: 'manual',
      source_factory_id: 'MANUAL-17',
      factory_registration_no_new: 'REG-17',
      factory_registration_no_old: 'OLD-17',
    });
    const factory = await connectionRequestsRepository.findDirectConnectionFactory(
      { factoryId: 'REG-17', factoryRegistrationNo: 'OLD-17' },
      { actorUserId: 42, scope: 'ALL' },
    );
    expect(factory).toMatchObject({
      factoryId: 'REG-17',
      newRegistrationNo: 'REG-17',
      oldRegistrationNo: 'OLD-17',
    });
  });
});
