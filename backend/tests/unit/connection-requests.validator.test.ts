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
    measurementPoints: [
      {
        pointName: 'ปล่องระบาย A',
        pointCode: 'STACK-A',
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
    }
  });

  it('accepts add measurement point request and stamps the request type', () => {
    const result = addMeasurementPointRequestSchema.safeParse(validPayload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.requestType).toBe('ADD_MEASUREMENT_POINT');
    }
  });

  it('rejects add measurement point request without the three required form sections', () => {
    const result = addMeasurementPointRequestSchema.safeParse({
      ...validPayload,
      measurementPoints: [
        {
          pointName: 'ปล่องระบาย A',
          pointCode: 'STACK-A',
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
          pointCode: 'STACK-A',
          pointType: 'STACK',
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
        { ...validPayload.measurementPoints[0], pointCode: 'STACK-B' },
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
