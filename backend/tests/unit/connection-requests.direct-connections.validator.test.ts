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

  it('accepts a CEMS point without documents and images', () => {
    const payload = validPayload();
    const { documentsAndImages: _documentsAndImages, ...pointWithoutDocuments } =
      payload.measurementPoints[0];

    const result = directConnectionRequestSchema.safeParse({
      ...payload,
      systemType: 'CEMS',
      measurementPoints: [
        {
          ...pointWithoutDocuments,
          pointType: 'STACK',
          details: {
            stackShape: 'วงกลม',
            stackDiameter: 1.2,
            connectionDevice: 'D-POMS Client (ใหม่)',
          },
        },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      measurementPoints: [{ documentsAndImages: [] }],
    });
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
        requestNo: 'OLDW-69-99999',
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
