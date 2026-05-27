import { describe, expect, it } from '@jest/globals';
import {
  confirmConnectionSchema,
  createConnectionRequestSchema,
  reviewConnectionRequestSchema,
  verifyConnectionSchema,
} from '../../src/modules/connection-requests/connection-requests.validator';

describe('connection request validators', () => {
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
      },
    ],
    remarks: 'ขอเชื่อมต่อระบบใหม่',
  };

  it('accepts a valid request form with measurement points', () => {
    const result = createConnectionRequestSchema.safeParse(validPayload);

    expect(result.success).toBe(true);
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
});
