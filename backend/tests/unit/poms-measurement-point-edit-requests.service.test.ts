import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/poms-factories/poms-factories.repository', () => ({
  pomsFactoriesRepository: {
    listFactories: jest.fn(),
    findFactoryDetail: jest.fn(),
    findOpenEditRequestForFactory: jest.fn(),
    createEditRequest: jest.fn(),
    listEditRequests: jest.fn(),
    findEditRequestById: jest.fn(),
    resubmitEditRequest: jest.fn(),
    reviewEditRequest: jest.fn(),
  },
}));

import { pomsFactoriesRepository } from '../../src/modules/poms-factories/poms-factories.repository';
import { pomsFactoriesService } from '../../src/modules/poms-factories/poms-factories.service';

const mockedRepository = jest.mocked(pomsFactoriesRepository);

describe('integrated POMS measurement-point edit service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRepository.findFactoryDetail.mockResolvedValue(factoryDetail() as never);
    mockedRepository.findOpenEditRequestForFactory.mockResolvedValue(null);
    mockedRepository.createEditRequest.mockResolvedValue(editRequest() as never);
  });

  it('preserves point identity, type, code, and parameters while applying editable fields', async () => {
    await pomsFactoriesService.createEditRequest(
      'factory-001',
      {
        formType: 'MEASUREMENT_POINTS',
        measurementPoints: [
          {
            connectedPointId: 15,
            pointName: 'ปล่อง A (แก้ไข)',
            monitoringPointStatus: 'อยู่ระหว่างเชื่อมต่อ',
            details: { requestedParameters: ['NOx'] },
            documentsAndImages: [],
            measurementInstruments: {
              converterBrand: 'New converter',
              converterModel: 'N-200',
              parameters: [{ parameter: 'NOx (ppm)' }],
            },
          },
        ],
        note: 'ขอแก้ไขจุดตรวจวัด',
      },
      42,
      { scope: 'OWN_FACTORY' },
      null,
    );

    const payload = mockedRepository.createEditRequest.mock.calls[0]?.[1];
    expect(payload?.proposedMeasurementPoints).toHaveLength(1);
    expect(payload?.proposedMeasurementPoints?.[0]).toEqual(
      expect.objectContaining({
        connectedPointId: 15,
        sourceMeasurementPointId: 2,
        eligibleFactoryId: 7,
        factoryId: 'factory-001',
        systemType: 'CEMS',
        pointCode: 'S0001',
        pointType: 'STACK',
        parameters: ['CO (ppm)'],
        pointName: 'ปล่อง A (แก้ไข)',
        monitoringPointStatus: 'อยู่ระหว่างเชื่อมต่อ',
        details: { requestedParameters: ['NOx'] },
        documentsAndImages: [],
        measurementInstruments: expect.objectContaining({
          converterBrand: 'New converter',
          converterModel: 'N-200',
        }),
      }),
    );
  });
});

function factoryDetail() {
  return {
    eligibleFactoryId: 7,
    factoryId: 'factory-001',
    factoryRegistrationNo: '3-106-33/50สบ',
    factoryName: 'บริษัท ทดสอบ จำกัด',
    factoryAddress: '99 หมู่ 1',
    provinceName: 'ระยอง',
    industrialEstateName: null,
    latitude: 12.7,
    longitude: 101.1,
    eia: 'มี EIA',
    eiaOther: null,
    projectName: null,
    factoryFrontPhotos: [],
    factoryLogo: null,
    systemTypes: ['CEMS'],
    measurementPointCount: 1,
    pendingEditRequestCount: 0,
    updatedAt: '2026-09-01T00:00:00.000Z',
    measurementPoints: [
      {
        connectedPointId: 15,
        sourceMeasurementPointId: 2,
        eligibleFactoryId: 7,
        factoryId: 'factory-001',
        factoryName: 'บริษัท ทดสอบ จำกัด',
        systemType: 'CEMS',
        pointName: 'ปล่อง A',
        pointCode: 'S0001',
        pointType: 'STACK',
        parameters: ['CO (ppm)'],
        monitoringPointStatus: null,
        details: null,
        documentsAndImages: [],
        measurementInstruments: null,
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    ],
  };
}

function editRequest() {
  return {
    id: 11,
    requestNo: 'PFE-20260901-ABC12345',
    eligibleFactoryId: 7,
    factoryId: 'factory-001',
    factoryRegistrationNo: '3-106-33/50สบ',
    factoryName: 'บริษัท ทดสอบ จำกัด',
    formType: 'MEASUREMENT_POINTS',
    status: 'PENDING_REVIEW',
    statusLabel: 'รอพิจารณา',
    revisionNo: 0,
    isOpen: true,
    requestNote: null,
    revisionReason: null,
    officerNote: null,
    currentFactory: factoryDetail(),
    proposedFactory: factoryDetail(),
    currentMeasurementPoints: factoryDetail().measurementPoints,
    proposedMeasurementPoints: factoryDetail().measurementPoints,
    submittedBy: 42,
    reviewedBy: null,
    submittedAt: '2026-09-01T00:00:00.000Z',
    reviewedAt: null,
    approvedAt: null,
    createdBy: 42,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    events: [],
  };
}
