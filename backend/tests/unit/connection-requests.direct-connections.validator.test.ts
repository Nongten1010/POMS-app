import { describe, expect, it } from '@jest/globals';
import type { ZodType } from 'zod';
import * as validators from '../../src/modules/connection-requests/connection-requests.validator';

const directConnectionRequestSchema = (
  validators as unknown as { directConnectionRequestSchema: ZodType }
).directConnectionRequestSchema;

describe('directConnectionRequestSchema', () => {
  it('accepts and trims an arbitrary point code while forcing the request type', () => {
    const result = directConnectionRequestSchema.safeParse(validPayload());

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      requestType: 'ADD_MEASUREMENT_POINT',
      measurementPoints: [{ pointCode: 'custom value/ก-01' }],
    });
  });

  it('accepts null for every optional direct-connection field and derives database-required point fields', () => {
    const result = directConnectionRequestSchema.safeParse(nullablePayload());

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      factoryId: 'factory-001',
      factoryName: '',
      factoryRegistrationNo: 'factory-001',
      systemType: 'WPMS',
      contactName: '',
      contactPhone: '',
      measurementPoints: [
        {
          pointName: 'custom value/ก-01',
          pointCode: 'custom value/ก-01',
          pointType: 'WASTEWATER',
          latitude: null,
          longitude: null,
          parameters: [],
          description: null,
          details: null,
          documentsAndImages: [],
          measurementInstruments: null,
        },
      ],
    });
  });

  it('accepts the documented minimal payload with omitted optional fields', () => {
    const result = directConnectionRequestSchema.safeParse({
      factoryId: 'factory-001',
      systemType: 'CEMS',
      measurementPoints: [{ pointCode: 'S1125' }],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      measurementPoints: [
        {
          pointName: 'S1125',
          pointCode: 'S1125',
          pointType: 'STACK',
        },
      ],
    });
  });

  it('accepts factoryRegistrationNo as the only eligible-factory identifier', () => {
    const result = directConnectionRequestSchema.safeParse({
      ...nullablePayload(),
      factoryId: null,
      factoryRegistrationNo: 'REG-001',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      factoryId: 'REG-001',
      factoryRegistrationNo: 'REG-001',
    });
  });

  it('requires at least one eligible-factory identifier', () => {
    const result = directConnectionRequestSchema.safeParse({
      ...nullablePayload(),
      factoryId: null,
      factoryRegistrationNo: null,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['factoryId'] })]),
    );
  });

  it('rejects anything other than exactly one point', () => {
    const payload = validPayload();
    const result = directConnectionRequestSchema.safeParse({
      ...payload,
      measurementPoints: [payload.measurementPoints[0], payload.measurementPoints[0]],
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['measurementPoints'] })]),
    );
  });

  it('rejects a blank point code at the point-code path', () => {
    const payload = validPayload();
    const result = directConnectionRequestSchema.safeParse({
      ...payload,
      measurementPoints: [{ ...payload.measurementPoints[0], pointCode: ' ' }],
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ['measurementPoints', 0, 'pointCode'] }),
      ]),
    );
  });

  it('rejects server-owned request fields', () => {
    expect(
      directConnectionRequestSchema.safeParse({
        ...validPayload(),
        requestNo: 'WEMS-9999/2569',
        status: 'CONNECTED',
        submissionSource: 'OPERATOR_FORM',
      }).success,
    ).toBe(false);
  });
});

function validPayload() {
  return {
    factoryId: 'factory-001',
    factoryName: 'โรงงานทดสอบ',
    factoryRegistrationNo: 'REG-001',
    eia: 'มี EIA',
    hasEia: true,
    systemType: 'WPMS',
    contactPersons: [{ name: 'ผู้ประสานงาน', phone: '0812345678' }],
    measurementPoints: [
      {
        pointName: 'จุดน้ำทิ้ง 1',
        pointCode: '  custom value/ก-01  ',
        pointType: 'WASTEWATER',
        details: {
          monitoringPointKind: 'WPMS',
          eligibleParameters: ['BOD (mg/l)'],
          exemptedParameters: ['ไม่มี'],
          connectedParameters: ['ไม่มี'],
          pendingParameters: ['BOD (mg/l)'],
          requestedParameters: ['BOD (mg/l)'],
          hasTreatmentSystem: 'มี',
          treatmentSystem: ['Activated Sludge'],
          maxTreatmentCapacity: 100,
          connectionDevice: 'D-POMS Client (ใหม่)',
        },
        documentsAndImages: [],
        measurementInstruments: {
          converterBrand: null,
          converterModel: null,
          parameters: [],
        },
      },
    ],
  };
}

function nullablePayload() {
  return {
    factoryId: 'factory-001',
    factoryName: null,
    factoryRegistrationNo: null,
    industryMainOrder: null,
    industryMainOrderLabel: null,
    industrySubOrder: null,
    businessActivity: null,
    eia: null,
    eiaOther: null,
    hasEia: null,
    projectName: null,
    address: null,
    regionCode: null,
    regionName: null,
    provinceCode: null,
    provinceName: null,
    districtCode: null,
    districtName: null,
    subdistrictCode: null,
    subdistrictName: null,
    industrialEstateCode: null,
    industrialEstateName: null,
    latitude: null,
    longitude: null,
    systemType: 'WPMS',
    type: null,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    contactPersons: null,
    notificationEmails: null,
    officerNotificationEmails: null,
    informationProviderName: null,
    informationProviderPosition: null,
    measurementPoints: [
      {
        pointName: null,
        pointCode: '  custom value/ก-01  ',
        pointType: null,
        latitude: null,
        longitude: null,
        parameters: null,
        description: null,
        details: null,
        documentsAndImages: null,
        measurementInstruments: null,
      },
    ],
    remarks: null,
  };
}
