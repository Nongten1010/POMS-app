import { describe, expect, it } from '@jest/globals';
import {
  createPomsFactoryEditRequestSchema,
  resubmitPomsFactoryEditRequestSchema,
} from '../../src/modules/poms-factories/poms-factories.validator';

const validMeasurementPointRequest = {
  formType: 'MEASUREMENT_POINTS' as const,
  measurementPoints: [
    {
      connectedPointId: 15,
      pointName: 'ปล่อง A (แก้ไข)',
      monitoringPointStatus: 'อยู่ระหว่างเชื่อมต่อ' as const,
      details: { stackHeight: 35 },
      documentsAndImages: [],
      measurementInstruments: null,
    },
  ],
  note: 'ขอแก้ไขข้อมูลจุดตรวจวัด',
};

describe('integrated POMS measurement-point edit request validator', () => {
  it('accepts only the editable point fields while using connectedPointId as the selector', () => {
    const result = createPomsFactoryEditRequestSchema.safeParse(validMeasurementPointRequest);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual(validMeasurementPointRequest);
  });

  it('requires at least one editable field in every requested measurement-point patch', () => {
    const result = createPomsFactoryEditRequestSchema.safeParse({
      formType: 'MEASUREMENT_POINTS',
      measurementPoints: [
        {
          connectedPointId: 15,
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ['pointCode', 'S9999'],
    ['parameters', ['CO (ppm)']],
    ['pointType', 'STACK'],
    ['systemType', 'CEMS'],
    ['sourceMeasurementPointId', 2],
    ['eligibleFactoryId', 7],
    ['factoryId', 'factory-001'],
    ['id', 15],
    ['deviceConnectionId', 91],
    ['deviceConfig', { protocol: 'MQTT' }],
    ['updatedAt', '2026-09-01T00:00:00.000Z'],
  ])('rejects immutable, identity, parameter, or device field %s', (field, value) => {
    const result = createPomsFactoryEditRequestSchema.safeParse({
      formType: 'MEASUREMENT_POINTS',
      measurementPoints: [
        {
          connectedPointId: 15,
          pointName: 'ปล่อง A',
          [field]: value,
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('uses the same strict allowlist for measurement-point resubmission', () => {
    expect(
      resubmitPomsFactoryEditRequestSchema.safeParse(validMeasurementPointRequest).success,
    ).toBe(true);
    expect(
      resubmitPomsFactoryEditRequestSchema.safeParse({
        ...validMeasurementPointRequest,
        measurementPoints: [
          {
            ...validMeasurementPointRequest.measurementPoints[0],
            parameters: ['NOx (ppm)'],
          },
        ],
      }).success,
    ).toBe(false);
  });
});
