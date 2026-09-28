import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';

jest.mock('../../src/config/database', () => ({ db: jest.fn() }));
jest.mock('../../src/modules/device-connections/device-connections.service', () => ({
  deviceConnectionsService: { listActiveSettings: jest.fn(async () => []) },
}));

import { db } from '../../src/config/database';
import { env } from '../../src/config/env';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';
import { connectionRequestsService } from '../../src/modules/connection-requests/connection-requests.service';
import {
  CONNECTION_REQUEST_STATUS,
  CONNECTION_REQUEST_TYPE,
  type ConnectionRequestDTO,
  type FactoryGeneralDTO,
  type MeasurementPointDTO,
  type RequestDocumentImageInput,
} from '../../src/modules/connection-requests/connection-requests.types';

const FRONT_TITLE = 'ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน';
const LOGO_TITLE = 'สัญลักษณ์ของโรงงานหรือโลโก้บริษัท';
const frontPhoto: RequestDocumentImageInput = {
  title: FRONT_TITLE,
  description: 'ป้ายโรงงานปัจจุบัน',
  fileName: 'front.png',
  fileUrl: 'https://example.com/uploads/front.png',
  fileType: 'image/png',
  fileSize: 1234,
};
const logo: RequestDocumentImageInput = {
  title: LOGO_TITLE,
  fileName: 'logo.png',
  fileUrl: 'https://example.com/uploads/logo.png',
  fileType: 'image/png',
  fileSize: 4321,
};
const pointDocument: RequestDocumentImageInput = {
  title: 'แผนผังจุดตรวจวัด',
  description: 'เอกสารเฉพาะจุดตรวจวัด',
  link: 'https://example.com/point-plan',
  fileName: 'plan.pdf',
  fileUrl: 'https://example.com/uploads/plan.pdf',
  fileType: 'application/pdf',
  fileSize: 5000,
};
const oldFront = { ...frontPhoto, fileUrl: 'https://example.com/uploads/old-front.png' };
const oldLogo = { ...logo, fileUrl: 'https://example.com/uploads/old-logo.png' };
type DatabaseRow = Record<string, unknown>;
let currentRows: DatabaseRow[];
const initialProfileMode = env.FACTORY_PROFILE_MODE;

beforeEach(() => {
  currentRows = [currentRow(1, 'S0001'), currentRow(2, 'S0002')];
  jest.spyOn(connectionRequestsRepository, 'list').mockResolvedValue({
    rows: [requestDto({ status: CONNECTION_REQUEST_STATUS.CONNECTED })],
    total: 1,
  });
  jest
    .spyOn(connectionRequestsRepository, 'findActiveEligibleFactoryReference')
    .mockResolvedValue(null);
  jest
    .spyOn(connectionRequestsRepository, 'findFactoryGeneral')
    .mockResolvedValue(factoryGeneral());
  jest
    .spyOn(connectionRequestsRepository, 'findFactorySummariesForRequests')
    .mockResolvedValue(new Map());
  jest.mocked(db).mockImplementation(((table: string) => {
    const columns: string[] = [];
    const chain = {
      whereNull: () => chain,
      where: () => chain,
      whereIn: () => chain,
      orWhereIn: () => chain,
      whereRaw: () => chain,
      as: () => chain,
      orderBy: () => chain,
      select: (...args: unknown[]) => {
        columns.push(...args.flat().filter((value): value is string => typeof value === 'string'));
        return chain;
      },
      then: (resolve: (rows: DatabaseRow[]) => unknown) =>
        resolve(
          table.includes('connected_measurement_points')
            ? currentRows.map((row) =>
                Object.fromEntries(columns.map((column) => [column, row[column]])),
              )
            : [],
        ),
    };
    return chain;
  }) as unknown as Knex);
});

afterEach(() => {
  env.FACTORY_PROFILE_MODE = initialProfileMode;
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe.each(['legacy', 'canonical'] as const)(
  'parameter form factory assets (%s profile source)',
  (mode) => {
    beforeEach(() => {
      env.FACTORY_PROFILE_MODE = mode;
    });

    it.each(['[]', null])(
      'includes both current factory assets when point documents are empty (%s)',
      async (documents) => {
        currentRows[0] = currentRow(1, 'S0001', { documents_json: documents });
        const result = await connectionRequestsService.getAddParameterFormDetail(
          'S0001',
          42,
          'ALL',
        );

        expect(result.formDefaults.measurementPoints[0].documentsAndImages).toEqual([
          frontPhoto,
          logo,
        ]);
        expect(result.formDefaults).not.toHaveProperty('factoryFrontPhotos');
        expect(result.formDefaults).not.toHaveProperty('factoryLogo');
        expect(db).toHaveBeenCalledWith(
          mode === 'canonical'
            ? 'current_connected_measurement_points'
            : 'cems_wpms_connected_measurement_points',
        );
      },
    );

    it('selects the requested station and replaces stale/duplicate profile entries without losing other documents', async () => {
      currentRows[1] = currentRow(2, 'S0002', {
        documents_json: JSON.stringify([pointDocument, oldFront, oldLogo, frontPhoto, logo]),
        factory_front_photos_json: JSON.stringify([frontPhoto]),
        factory_logo_json: JSON.stringify(logo),
      });
      currentRows[0] = currentRow(1, 'S0001', {
        factory_front_photos_json: JSON.stringify([
          { ...frontPhoto, fileUrl: 'https://example.com/other-station.png' },
        ]),
      });

      const result = await connectionRequestsService.getAddParameterFormDetail('S0002', 42, 'ALL');
      const point = result.formDefaults.measurementPoints[0];

      expect(result.formDefaults.measurementPoints).toHaveLength(1);
      expect(point.pointCode).toBe('S0002');
      expect(point.documentsAndImages).toHaveLength(3);
      expect(point.documentsAndImages).toEqual(
        expect.arrayContaining([pointDocument, frontPhoto, logo]),
      );
    });

    it('normalizes profile asset titles to the form contract and retains all other metadata', async () => {
      currentRows[0] = currentRow(1, 'S0001', {
        factory_front_photos_json: JSON.stringify([{ ...frontPhoto, title: 'ภาพถ่ายหน้าโรงงาน' }]),
        factory_logo_json: JSON.stringify({ ...logo, title: 'company-logo.png' }),
      });

      const result = await connectionRequestsService.getAddParameterFormDetail('S0001', 42, 'ALL');

      expect(result.formDefaults.measurementPoints[0].documentsAndImages).toEqual([
        frontPhoto,
        logo,
      ]);
    });

    it('keeps distinct front photos and removes duplicate file URLs or links', async () => {
      const linkedPhoto: RequestDocumentImageInput = {
        title: FRONT_TITLE,
        description: 'ภาพป้ายโรงงานจากลิงก์',
        link: 'https://example.com/factory-sign',
      };
      currentRows[0] = currentRow(1, 'S0001', {
        factory_front_photos_json: JSON.stringify([
          frontPhoto,
          frontPhoto,
          linkedPhoto,
          linkedPhoto,
        ]),
      });

      const result = await connectionRequestsService.getAddParameterFormDetail('S0001', 42, 'ALL');

      expect(result.formDefaults.measurementPoints[0].documentsAndImages).toEqual([
        frontPhoto,
        linkedPhoto,
        logo,
      ]);
    });

    it.each(['[]', null])(
      'does not restore removed factory assets or historical request documents (%s)',
      async (emptyPhotos) => {
        currentRows[0] = currentRow(1, 'S0001', {
          documents_json: JSON.stringify([pointDocument, oldFront, oldLogo]),
          factory_front_photos_json: emptyPhotos,
          factory_logo_json: null,
        });

        const result = await connectionRequestsService.getAddParameterFormDetail(
          'S0001',
          42,
          'ALL',
        );

        expect(result.formDefaults.measurementPoints[0].documentsAndImages).toEqual([
          pointDocument,
        ]);
      },
    );

    it('keeps connected-point list documents unchanged by the parameter form merge', async () => {
      currentRows[0] = currentRow(1, 'S0001', { documents_json: JSON.stringify([pointDocument]) });
      await connectionRequestsService.getAddParameterFormDetail('S0001', 42, 'ALL');

      const result = await connectionRequestsService.listConnectedMeasurementPoints(
        { stationId: 'S0001' },
        42,
        'ALL',
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].point.documentsAndImages).toEqual([pointDocument]);
    });
  },
);

function currentRow(id: number, stationId: string, overrides: DatabaseRow = {}): DatabaseRow {
  return {
    id: id + 10,
    source_request_id: 1,
    source_measurement_point_id: id,
    factory_id: 'factory-001',
    eligible_factory_id: 17,
    point_name: `ปล่อง ${id}`,
    point_code: stationId,
    point_type: 'STACK',
    system_type: 'CEMS',
    parameters_json: '[]',
    documents_json: '[]',
    factory_front_photos_json: JSON.stringify([frontPhoto]),
    factory_logo_json: JSON.stringify(logo),
    ...overrides,
  };
}

function snapshot(id: number, stationId: string): MeasurementPointDTO {
  return {
    id,
    pointCode: stationId,
    pointName: `ปล่อง ${id}`,
    pointType: 'STACK',
    latitude: null,
    longitude: null,
    parameters: [],
    description: null,
    documentsAndImages: [
      oldFront,
      oldLogo,
      {
        title: 'เอกสารคำขอเก่า',
        fileUrl: 'https://example.com/uploads/history.pdf',
      },
    ],
  };
}

function factoryGeneral(): FactoryGeneralDTO {
  return {
    id: 17,
    factoryId: 'factory-001',
    factoryName: 'โรงงานปัจจุบัน',
    newRegistrationNo: 'factory-001',
    oldRegistrationNo: null,
    industryType: null,
    industryMainOrder: null,
    industrySubOrder: null,
    businessActivity: null,
    eia: null,
    projectName: null,
    address: null,
    latitude: null,
    longitude: null,
    province: null,
    eligibleFactoryId: 17,
    juristicId: null,
    juristicName: null,
    industrialEstateName: null,
    systemId: null,
    systemDetail: null,
    verifyStatus: null,
    authorizeStart: null,
    authorizeEnd: null,
    operationStatus: null,
    capitalAmount: null,
    machineryHorsepower: null,
    productionCapacity: null,
    wastewaterDischargeInfo: null,
    boilerCount: null,
    boilerSizeEach: null,
    fuelUsed: null,
    hasEia: null,
    formDefaults: {
      factoryId: 'factory-001',
      factoryName: 'โรงงานปัจจุบัน',
      factoryRegistrationNo: 'factory-001',
    },
  };
}

function requestDto(overrides: Partial<ConnectionRequestDTO> = {}): ConnectionRequestDTO {
  return {
    id: 1,
    requestNo: 'CEMS-0001/2569',
    requestType: CONNECTION_REQUEST_TYPE.NEW_CONNECTION,
    requestTypeLabel: 'ขอเชื่อมต่อใหม่',
    factoryId: 'factory-001',
    factoryName: 'บริษัท ทดสอบ จำกัด',
    factoryRegistrationNo: '3-106-33/50สบ',
    industryMainOrder: '106',
    industrySubOrder: '33',
    businessActivity: 'ผลิตเคมีภัณฑ์',
    eia: 'มี',
    eiaOther: null,
    hasEia: true,
    projectName: 'โครงการทดสอบ CEMS',
    address: '99 หมู่ 1 ตำบลทดสอบ อำเภอเมือง จังหวัดสระบุรี',
    latitude: 13.7563,
    longitude: 100.5018,
    systemType: 'CEMS',
    status: CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
    statusLabel: 'รอพิจารณาแบบ',
    contactName: 'สมชาย ใจดี',
    contactPhone: '0812345678',
    contactEmail: 'ops@example.com',
    contactPersons: [
      {
        name: 'สมชาย ใจดี',
        phone: '0812345678',
        email: 'ops@example.com',
        position: 'ผู้จัดการสิ่งแวดล้อม',
      },
    ],
    notificationEmails: ['ops@example.com'],
    officerNotificationEmails: ['officer@example.com'],
    informationProviderName: 'ธนากรณ์ ศรีคอม',
    informationProviderPosition: 'ผู้จัดการโรงงาน',
    remarks: null,
    revisionReason: null,
    officerNote: null,
    connectionDueAt: null,
    confirmedAt: null,
    verifiedAt: null,
    measurementPoints: [snapshot(1, 'S0001'), snapshot(2, 'S0002')],
    statusHistory: [],
    statusDurationSummary: {
      startedAt: null,
      startDate: null,
      startStatus: null,
      startStatusLabel: null,
      endedAt: null,
      endDate: null,
      endStatus: null,
      endStatusLabel: null,
      isTerminal: false,
      terminalStatuses: [CONNECTION_REQUEST_STATUS.CONNECTED, CONNECTION_REQUEST_STATUS.CANCELED],
      totalDurationDays: null,
      totalDurationText: null,
    },
    createdBy: 42,
    createdAt: '2026-05-27T10:00:00.000Z',
    updatedAt: '2026-05-27T10:00:00.000Z',
    ...overrides,
    industryMainOrderLabel: overrides.industryMainOrderLabel ?? null,
    regionCode: overrides.regionCode ?? null,
    regionName: overrides.regionName ?? null,
    provinceCode: overrides.provinceCode ?? null,
    provinceName: overrides.provinceName ?? null,
    districtCode: overrides.districtCode ?? null,
    districtName: overrides.districtName ?? null,
    subdistrictCode: overrides.subdistrictCode ?? null,
    subdistrictName: overrides.subdistrictName ?? null,
    industrialEstateCode: overrides.industrialEstateCode ?? null,
    industrialEstateName: overrides.industrialEstateName ?? null,
    submissionSource: overrides.submissionSource ?? 'OPERATOR_FORM',
  };
}
