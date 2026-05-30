import { describe, expect, it } from '@jest/globals';
import {
  addMeasurementPointRequestSchema,
  addParameterRequestSchema,
  changeConnectionRequestStatusSchema,
  confirmConnectionSchema,
  connectionRequestDeviceConfigParamsSchema,
  createConnectionRequestSchema,
  deviceConfigFormQuerySchema,
  reviewConnectionRequestSchema,
  verifyConnectionSchema,
} from '../../src/modules/connection-requests/connection-requests.validator';

describe('connection request validators', () => {
  const pointDetails = {
    stackShape: 'วงกลม',
    stackDiameter: 1.2,
    stackHeight: 30,
    connectionDevice: 'POMS Box (กรอ.)',
  };
  const documentsAndImages = [
    {
      title: 'ภาพถ่ายปล่อง',
      fileName: 'stack.png',
      fileUrl: 'https://example.com/files/stack.png',
      fileType: 'image/png',
      fileSize: 1024,
    },
  ];
  const measurementInstruments = {
    converterBrand: 'Converter Brand',
    converterModel: 'CV-100',
    parameters: [
      {
        parameter: 'NOx',
        technique: 'NDIR',
        range: '0-200',
        brand: 'Siemens',
        supplier: 'ABC Tech',
        eiaStandard: '120',
        standardCondition: true,
        dryBasis: true,
        oxygenOrExcessAir: true,
      },
    ],
  };
  const validPayload = {
    factoryId: 'factory-001',
    factoryName: 'บริษัท ทดสอบ จำกัด',
    factoryRegistrationNo: '3-106-33/50สบ',
    systemType: 'CEMS',
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
      {
        name: 'สมหญิง ใจดี',
        phone: '0899999999',
        email: 'ops2@example.com',
        position: 'วิศวกร',
      },
    ],
    notificationEmails: ['ops@example.com', 'ops2@example.com'],
    measurementPoints: [
      {
        pointName: 'ปล่องระบาย A',
        pointCode: 'S0001',
        pointType: 'STACK',
        latitude: 13.7563,
        longitude: 100.5018,
        parameters: ['NOx', 'SO2', 'PM'],
        description: 'จุดตรวจวัดหลัก',
        details: pointDetails,
        documentsAndImages,
        measurementInstruments,
      },
    ],
    remarks: 'ขอเชื่อมต่อระบบใหม่',
  };

  it('accepts a valid request form with measurement points', () => {
    const result = createConnectionRequestSchema.safeParse(validPayload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.requestType).toBe('NEW_CONNECTION');
      expect(result.data.contactPersons).toHaveLength(2);
      expect(result.data.notificationEmails).toEqual(['ops@example.com', 'ops2@example.com']);
    }
  });

  it('accepts measurement instrument criteria thresholds', () => {
    const result = createConnectionRequestSchema.safeParse({
      ...validPayload,
      measurementPoints: [
        {
          ...validPayload.measurementPoints[0],
          measurementInstruments: {
            ...measurementInstruments,
            parameters: [
              {
                ...measurementInstruments.parameters[0],
                standardCriteria: {
                  enabled: true,
                  standardValue: '120',
                  rows: [
                    { level: 'normal', min: 0, max: 80 },
                    { level: 'warning', min: 80, max: 100 },
                    { level: 'critical', min: 100, max: null },
                  ],
                },
                eiaCriteria: {
                  enabled: false,
                  standardValue: '',
                  rows: [],
                },
              },
            ],
          },
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const parameter =
        result.data.measurementPoints[0].measurementInstruments?.parameters[0];
      expect(parameter?.standardCriteria).toEqual({
        enabled: true,
        standardValue: '120',
        rows: [
          { level: 'normal', min: 0, max: 80 },
          { level: 'warning', min: 80, max: 100 },
          { level: 'critical', min: 100, max: null },
        ],
      });
      expect(parameter?.eiaCriteria).toEqual({
        enabled: false,
        standardValue: null,
        rows: [],
      });
    }
  });

  it('rejects enabled measurement criteria without all threshold levels', () => {
    const result = createConnectionRequestSchema.safeParse({
      ...validPayload,
      measurementPoints: [
        {
          ...validPayload.measurementPoints[0],
          measurementInstruments: {
            ...measurementInstruments,
            parameters: [
              {
                ...measurementInstruments.parameters[0],
                standardCriteria: {
                  enabled: true,
                  standardValue: '120',
                  rows: [
                    { level: 'normal', min: 0, max: 80 },
                    { level: 'warning', min: 80, max: 100 },
                  ],
                },
              },
            ],
          },
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('maps legacy single contact fields to contact arrays', () => {
    const { contactPersons, notificationEmails, ...legacyPayload } = validPayload;
    const result = createConnectionRequestSchema.safeParse(legacyPayload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contactPersons).toEqual([
        {
          name: 'สมชาย ใจดี',
          phone: '0812345678',
          email: 'ops@example.com',
          position: null,
        },
      ]);
      expect(result.data.notificationEmails).toEqual(['ops@example.com']);
    }
  });

  it('accepts add measurement point request and stamps the request type', () => {
    const result = addMeasurementPointRequestSchema.safeParse(validPayload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.requestType).toBe('ADD_MEASUREMENT_POINT');
    }
  });

  it('accepts CEMS conditional detail fields and multi-value parameter groups', () => {
    const result = addMeasurementPointRequestSchema.safeParse({
      ...validPayload,
      measurementPoints: [
        {
          ...validPayload.measurementPoints[0],
          details: {
            monitoringPointKind: 'CEMS',
            eligibleParameters: ['NOx', 'SO2'],
            exemptedParameters: ['PM'],
            connectedParameters: ['O2', 'Flow'],
            pendingParameters: ['CO', 'CO2'],
            stackShape: 'สี่เหลี่ยม',
            stackWidth: 1.5,
            stackLength: 2,
            hasTreatmentSystem: 'มี',
            treatmentSystem: 'อื่นๆ',
            treatmentSystemOther: 'ระบบเฉพาะโรงงาน',
            connectionDevice: 'อื่นๆ',
            connectionDeviceOther: 'Gateway เดิม',
          },
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('accepts WPMS detail fields separately from CEMS fields', () => {
    const result = addMeasurementPointRequestSchema.safeParse({
      ...validPayload,
      systemType: 'WPMS',
      measurementPoints: [
        {
          ...validPayload.measurementPoints[0],
          pointType: 'WASTEWATER',
          parameters: ['BOD (mg/l)', 'COD (mg/l)'],
          details: {
            monitoringPointKind: 'WPMS',
            averageWastewaterDischarge: 500,
            minWastewaterDischarge: 300,
            maxWastewaterDischarge: 800,
            hasTreatmentSystem: 'มี',
            treatmentSystem: 'ระบบบำบัดชีวภาพ',
            maxTreatmentCapacity: 1000,
            instrumentLatitude: 13.7563,
            instrumentLongitude: 100.5018,
            wastewaterSource: 'กระบวนการผลิต',
            dischargeReceivingSource: 'คลองสาธารณะ',
            connectionDevice: 'POMS Box (กรอ.)',
          },
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('rejects missing conditional detail fields and wrong parameter group type', () => {
    const result = addMeasurementPointRequestSchema.safeParse({
      ...validPayload,
      measurementPoints: [
        {
          ...validPayload.measurementPoints[0],
          details: {
            stackShape: 'สี่เหลี่ยม',
            stackWidth: 1.5,
            eligibleParameters: 'NOx',
            hasTreatmentSystem: 'มี',
            treatmentSystem: 'อื่นๆ',
            connectionDevice: 'อื่นๆ',
          },
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects CEMS-only detail fields in WPMS requests', () => {
    const result = addMeasurementPointRequestSchema.safeParse({
      ...validPayload,
      systemType: 'WPMS',
      measurementPoints: [
        {
          ...validPayload.measurementPoints[0],
          pointType: 'WASTEWATER',
          details: {
            monitoringPointKind: 'WPMS',
            stackShape: 'วงกลม',
            stackDiameter: 1.2,
            hasTreatmentSystem: 'ไม่มี',
            connectionDevice: 'POMS Box (กรอ.)',
          },
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects add measurement point request without the three required form sections', () => {
    const result = addMeasurementPointRequestSchema.safeParse({
      ...validPayload,
      measurementPoints: [
        {
          pointName: 'ปล่องระบาย A',
          pointType: 'STACK',
          parameters: ['NOx'],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('accepts add parameter request for exactly one measurement point', () => {
    const result = addParameterRequestSchema.safeParse({
      ...validPayload,
      measurementPoints: [
        {
          ...validPayload.measurementPoints[0],
          parameters: ['CO'],
          details: undefined,
          documentsAndImages: undefined,
          measurementInstruments: {
            ...measurementInstruments,
            parameters: [{ ...measurementInstruments.parameters[0], parameter: 'CO' }],
          },
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.requestType).toBe('ADD_PARAMETER');
    }
  });

  it('rejects add parameter request without measurement instruments', () => {
    const result = addParameterRequestSchema.safeParse({
      ...validPayload,
      measurementPoints: [
        {
          pointName: 'ปล่องระบาย A',
          pointCode: 'S0001',
          pointType: 'STACK',
          parameters: ['CO'],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects add parameter request without an existing point code', () => {
    const result = addParameterRequestSchema.safeParse({
      ...validPayload,
      measurementPoints: [
        {
          ...validPayload.measurementPoints[0],
          pointCode: null,
          parameters: ['CO'],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects add parameter request with multiple measurement points', () => {
    const result = addParameterRequestSchema.safeParse({
      ...validPayload,
      measurementPoints: [
        validPayload.measurementPoints[0],
        { ...validPayload.measurementPoints[0], pointCode: 'S0002' },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects unknown fields', () => {
    const result = createConnectionRequestSchema.safeParse({
      ...validPayload,
      rawSql: 'DROP TABLE cems_wpms_connection_requests',
    });

    expect(result.success).toBe(false);
  });

  it('requires at least one measurement point', () => {
    const result = createConnectionRequestSchema.safeParse({
      ...validPayload,
      measurementPoints: [],
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid coordinates', () => {
    const result = createConnectionRequestSchema.safeParse({
      ...validPayload,
      measurementPoints: [{ ...validPayload.measurementPoints[0], latitude: 99 }],
    });

    expect(result.success).toBe(false);
  });

  it('requires a revision reason when officer requests changes', () => {
    const result = reviewConnectionRequestSchema.safeParse({
      decision: 'REQUEST_REVISION',
    });

    expect(result.success).toBe(false);
  });

  it('accepts status changes for approval and revision actions', () => {
    expect(
      changeConnectionRequestStatusSchema.safeParse({
        action: 'APPROVE_FORM',
        officerNote: 'แบบถูกต้อง',
      }).success,
    ).toBe(true);
    expect(
      changeConnectionRequestStatusSchema.safeParse({
        action: 'REQUEST_REVISION',
        revisionReason: 'เพิ่มเอกสาร config',
      }).success,
    ).toBe(true);
  });

  it('accepts connection confirmation and final verification payloads', () => {
    expect(
      confirmConnectionSchema.safeParse({
        confirmedAt: '2026-05-27T10:00:00.000Z',
        note: 'ส่งค่าเข้าระบบได้แล้ว',
      }).success,
    ).toBe(true);
    expect(
      verifyConnectionSchema.safeParse({
        verifiedAt: '2026-05-27T11:00:00.000Z',
        note: 'ตรวจสอบค่าในระบบแล้ว',
      }).success,
    ).toBe(true);
  });

  it('accepts device config form detail params and station query', () => {
    expect(
      connectionRequestDeviceConfigParamsSchema.safeParse({ id: '1', configId: '10' }).success,
    ).toBe(true);
    expect(deviceConfigFormQuerySchema.safeParse({ stationId: 'STACK-A' }).success).toBe(true);
  });
});
