import { describe, expect, it } from '@jest/globals';
import {
  addMeasurementPointRequestSchema,
  addParameterRequestSchema,
  changeConnectionRequestStatusSchema,
  confirmConnectionSchema,
  connectedMeasurementPointParamsSchema,
  connectionRequestDeviceConfigParamsSchema,
  createConnectionRequestSchema,
  deviceConfigFormQuerySchema,
  listConnectedMeasurementPointsQuerySchema,
  listConnectionRequestsQuerySchema,
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
    industryMainOrder: '106',
    industrySubOrder: '33',
    businessActivity: 'ผลิตเคมีภัณฑ์',
    eia: 'มี',
    projectName: 'โครงการทดสอบ CEMS',
    address: '99 หมู่ 1 ตำบลทดสอบ อำเภอเมือง จังหวัดสระบุรี',
    latitude: 13.7563,
    longitude: 100.5018,
    systemType: 'CEMS',
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
    officerNotificationEmails: ['officer@example.com'],
    informationProviderName: 'ธนากรณ์ ศรีคอม',
    informationProviderPosition: 'ผู้จัดการโรงงาน',
    measurementPoints: [
      {
        pointName: 'ปล่องระบาย A',
        pointCode: 'S0001',
        pointType: 'STACK',
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
      expect(result.data.industryMainOrder).toBe('106');
      expect(result.data.eia).toBe('มี');
      expect(result.data.latitude).toBe(13.7563);
      expect(result.data.contactPersons).toHaveLength(2);
      expect(result.data.notificationEmails).toEqual(['ops@example.com', 'ops2@example.com']);
      expect(result.data.officerNotificationEmails).toEqual(['officer@example.com']);
      expect(result.data.informationProviderName).toBe('ธนากรณ์ ศรีคอม');
      expect(result.data.informationProviderPosition).toBe('ผู้จัดการโรงงาน');
      expect(result.data.measurementPoints[0].parameters).toEqual(['NOx']);
    }
  });

  it('normalizes empty optional factory snapshot fields from frontend forms', () => {
    const result = addMeasurementPointRequestSchema.safeParse({
      ...validPayload,
      factoryRegistrationNo: '',
      industryMainOrder: '',
      industrySubOrder: '',
      businessActivity: '',
      eia: '',
      projectName: '',
      address: '',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.factoryRegistrationNo).toBe(validPayload.factoryId);
      expect(result.data.industryMainOrder).toBeNull();
      expect(result.data.industrySubOrder).toBeNull();
      expect(result.data.businessActivity).toBeNull();
      expect(result.data.eia).toBeNull();
      expect(result.data.projectName).toBeNull();
      expect(result.data.address).toBeNull();
    }
  });

  it('accepts factory location snapshot fields for request forms', () => {
    const result = addMeasurementPointRequestSchema.safeParse({
      ...validPayload,
      regionName: 'ภาคตะวันออก',
      provinceCode: '21',
      provinceName: 'ระยอง',
      districtName: 'เมืองระยอง',
      subdistrictName: 'มาบตาพุด',
      industrialEstateCode: 'MAP',
      industrialEstateName: 'นิคมอุตสาหกรรมมาบตาพุด',
      industryMainOrderLabel: 'ประเภทโรงงานลำดับที่ 88(2): การผลิตพลังงานไฟฟ้าจากพลังงานความร้อน',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.regionName).toBe('ภาคตะวันออก');
      expect(result.data.provinceCode).toBe('21');
      expect(result.data.provinceName).toBe('ระยอง');
      expect(result.data.districtName).toBe('เมืองระยอง');
      expect(result.data.subdistrictName).toBe('มาบตาพุด');
      expect(result.data.industrialEstateCode).toBe('MAP');
      expect(result.data.industrialEstateName).toBe('นิคมอุตสาหกรรมมาบตาพุด');
      expect(result.data.industryMainOrderLabel).toBe(
        'ประเภทโรงงานลำดับที่ 88(2): การผลิตพลังงานไฟฟ้าจากพลังงานความร้อน',
      );
    }
  });

  it('accepts advanced search filters on request list queries', () => {
    const result = listConnectionRequestsQuerySchema.safeParse({
      provinceName: ' ระยอง ',
      districtName: 'เมืองระยอง',
      industrialEstateName: 'นิคมอุตสาหกรรมมาบตาพุด',
      factoryMainTypeCode: '8802',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        provinceName: 'ระยอง',
        districtName: 'เมืองระยอง',
        industrialEstateName: 'นิคมอุตสาหกรรมมาบตาพุด',
        factoryMainTypeCode: '8802',
      });
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
                  enabled: false,
                  standardValue: '120',
                  rows: [
                    { level: 'normal', min: 0, max: 80 },
                    { level: 'warning', min: 80, max: 100 },
                    { level: 'critical', min: 100, max: null },
                  ],
                },
                eiaCriteria: {
                  enabled: true,
                },
              },
            ],
          },
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const parameter = result.data.measurementPoints[0].measurementInstruments?.parameters[0];
      expect(parameter?.standardCriteria).toEqual({
        enabled: false,
        standardValue: '120',
        rows: [
          { level: 'normal', min: 0, max: 80 },
          { level: 'warning', min: 80, max: 100 },
          { level: 'critical', min: 100, max: null },
        ],
      });
      expect(parameter?.eiaCriteria).toEqual({
        enabled: true,
        standardValue: null,
        rows: [],
      });
    }
  });

  it('does not require criteria thresholds when criteria is enabled', () => {
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
                },
                eiaCriteria: {
                  enabled: 'true',
                  standardValue: '',
                  rows: [{ level: 'normal', min: null, max: null }],
                },
              },
            ],
          },
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const parameter = result.data.measurementPoints[0].measurementInstruments?.parameters[0];
      expect(parameter?.standardCriteria).toEqual({
        enabled: true,
        standardValue: null,
        rows: [],
      });
      expect(parameter?.eiaCriteria).toEqual({
        enabled: true,
        standardValue: null,
        rows: [],
      });
    }
  });

  it('rejects disabled measurement criteria without all threshold levels', () => {
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
                  enabled: false,
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

  it('rejects disabled measurement criteria without a standard value', () => {
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
                  enabled: false,
                  rows: [
                    { level: 'normal', min: 0, max: 80 },
                    { level: 'warning', min: 80, max: 100 },
                    { level: 'critical', min: 100, max: null },
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
    const result = createConnectionRequestSchema.safeParse({
      ...legacyPayload,
      contactName: 'สมชาย ใจดี',
      contactPhone: '0812345678',
      contactEmail: 'ops@example.com',
    });

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
            legalAnnexNo: ['1', '3'],
            eligibleParameters: ['NOx', 'SO2'],
            exemptedParameters: ['PM'],
            connectedParameters: ['O2', 'Flow'],
            pendingParameters: ['CO', 'CO2'],
            timeSharingParameters: ['NOx', 'SO2'],
            sharedStackCode: 'S0002',
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

  it('rejects non-array CEMS time sharing parameters', () => {
    const result = addMeasurementPointRequestSchema.safeParse({
      ...validPayload,
      measurementPoints: [
        {
          ...validPayload.measurementPoints[0],
          details: {
            ...pointDetails,
            monitoringPointKind: 'CEMS',
            timeSharingParameters: 'NOx',
          },
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['measurementPoints', 0, 'details', 'timeSharingParameters'],
          }),
        ]),
      );
    }
  });

  it('rejects CEMS-only time sharing and shared stack fields on WPMS points', () => {
    const result = addMeasurementPointRequestSchema.safeParse({
      ...validPayload,
      systemType: 'WPMS',
      measurementPoints: [
        {
          pointName: 'จุดระบายน้ำทิ้ง A',
          pointCode: 'P0001',
          pointType: 'WASTEWATER',
          details: {
            monitoringPointKind: 'WPMS',
            averageWastewaterDischarge: 500,
            minWastewaterDischarge: 300,
            maxWastewaterDischarge: 800,
            hasTreatmentSystem: 'มี',
            treatmentSystem: 'ระบบบำบัดชีวภาพ',
            maxTreatmentCapacity: 1000,
            connectionDevice: 'POMS Box (กรอ.)',
            timeSharingParameters: ['BOD'],
            sharedStackCode: 'S0001',
          },
          measurementInstruments,
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['measurementPoints', 0, 'details', 'timeSharingParameters'],
          }),
          expect.objectContaining({
            path: ['measurementPoints', 0, 'details', 'sharedStackCode'],
          }),
        ]),
      );
    }
  });

  it('normalizes frontend CEMS aliases with blank point type and empty instrument parameters', () => {
    const result = addMeasurementPointRequestSchema.safeParse({
      ...validPayload,
      type: 'CEMS',
      measurementPoints: [
        {
          ...validPayload.measurementPoints[0],
          pointType: '',
          type: 'CEMS',
          details: {
            monitoringPointKind: 'CEMS',
            eligibleParameters: ['CO2 (%),CO2 (ppm),CO (ppm),Flow (m³/hr),H2S (ppm)'],
            pendingParameters: ['CO2 (%),CO2 (ppm),CO (ppm),Flow (m³/hr),H2S (ppm)'],
            stackShape: 'วงกลม',
            stackDiameter: 20,
            stackHeight: 200,
            hasTreatmentSystem: 'มี',
            treatmentSystem: 'ระบบดักจับฝุ่น',
            connectionDevice: 'POMS Client (ใหม่)',
          },
          measurementInstruments: {
            converterBrand: 'ABCTech',
            converterModel: '100',
            parameters: [],
          },
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.measurementPoints[0].pointType).toBe('STACK');
      expect(result.data.measurementPoints[0].measurementInstruments?.parameters).toEqual([
        expect.objectContaining({ parameter: 'CO2 (%)' }),
        expect.objectContaining({ parameter: 'CO2 (ppm)' }),
        expect.objectContaining({ parameter: 'CO (ppm)' }),
        expect.objectContaining({ parameter: 'Flow (m³/hr)' }),
        expect.objectContaining({ parameter: 'H2S (ppm)' }),
      ]);
      expect(result.data.measurementPoints[0].parameters).toEqual([
        'CO2 (%)',
        'CO2 (ppm)',
        'CO (ppm)',
        'Flow (m³/hr)',
        'H2S (ppm)',
      ]);
    }
  });

  it('prefers requested instrument parameters over all eligible point parameters', () => {
    const result = addParameterRequestSchema.safeParse({
      ...validPayload,
      measurementPoints: [
        {
          ...validPayload.measurementPoints[0],
          pointCode: 'S0001',
          parameters: ['CO (ppm)', 'NOx (ppm)', 'Temp. (°C)', 'O2 (%)', 'Flow (m³/hr)'],
          measurementInstruments: {
            converterBrand: 'Converter Brand',
            converterModel: 'CV-100',
            parameters: [
              { parameter: 'CO (ppm)' },
              { parameter: 'NOx (ppm)' },
              { parameter: 'Temp. (°C)' },
            ],
          },
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.measurementPoints[0].parameters).toEqual([
        'CO (ppm)',
        'NOx (ppm)',
        'Temp. (°C)',
      ]);
    }
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

  it('accepts WPMS add measurement point without documents and images', () => {
    const result = addMeasurementPointRequestSchema.safeParse({
      ...validPayload,
      systemType: 'WPMS',
      measurementPoints: [
        {
          ...validPayload.measurementPoints[0],
          pointType: 'WASTEWATER',
          documentsAndImages: undefined,
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
            connectionDevice: 'อื่นๆ',
            connectionDeviceOther: 'Gateway เดิมของโรงงาน',
          },
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.measurementPoints[0].documentsAndImages).toEqual([]);
    }
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

  it('rejects add parameter request without the measurement point form sections', () => {
    const result = addParameterRequestSchema.safeParse({
      ...validPayload,
      measurementPoints: [
        {
          pointName: 'ปล่องระบาย A',
          pointCode: 'S0001',
          pointType: 'STACK',
          parameters: ['CO'],
          measurementInstruments: {
            ...measurementInstruments,
            parameters: [{ ...measurementInstruments.parameters[0], parameter: 'CO' }],
          },
        },
      ],
    });

    expect(result.success).toBe(false);
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

  it('rejects duplicated measurement point names in the same request', () => {
    const result = createConnectionRequestSchema.safeParse({
      ...validPayload,
      measurementPoints: [
        validPayload.measurementPoints[0],
        {
          ...validPayload.measurementPoints[0],
          pointCode: 'S0002',
          pointName: ' ปล่องระบาย A ',
        },
      ],
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
    expect(
      changeConnectionRequestStatusSchema.safeParse({
        action: 'RETURN_TO_WAITING_CONNECTION',
        revisionReason: 'ตั้งค่าอุปกรณ์ยังไม่ถูกต้อง',
        officerNote: 'ส่งกลับให้แก้ config',
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

  it('accepts connected measurement point filters using stationId only', () => {
    expect(
      listConnectedMeasurementPointsQuerySchema.safeParse({
        factoryId: 'factory-001',
        stationId: 'STACK-A',
      }).success,
    ).toBe(true);
    expect(
      listConnectedMeasurementPointsQuerySchema.safeParse({
        pointCode: 'STACK-A',
      }).success,
    ).toBe(false);
  });

  it('accepts stationId filters for request lists and connected point params', () => {
    expect(
      listConnectionRequestsQuerySchema.safeParse({
        factoryId: 'factory-001',
        stationId: 'STACK-A',
      }).success,
    ).toBe(true);
    expect(connectedMeasurementPointParamsSchema.safeParse({ stationId: 'STACK-A' }).success).toBe(
      true,
    );
  });
});
