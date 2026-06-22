import { describe, expect, it } from '@jest/globals';
import { saveMonitoringPointFormSchema } from '../../src/modules/monitoring-point-forms/monitoring-point-forms.validator';

describe('monitoring point form validator', () => {
  it('accepts one factory with multiple CEMS and WPMS points', () => {
    const result = saveMonitoringPointFormSchema.parse({
      factory: {
        factoryName: 'สถานีบ่มใบยาสบหนอง',
        factoryRegistrationNoNew: '10520000225172',
        factoryRegistrationNoOld: '3-1-2/17ลป',
        provinceName: 'ลำปาง',
      },
      points: [
        {
          systemType: 'CEMS',
          pointCode: 'S0001',
          pointName: 'ปล่องหลัก',
          eligibleParameters: ['NOx (ppm)', 'SO2 (ppm)'],
        },
        {
          systemType: 'WPMS',
          pointCode: 'P0001',
          pointName: 'จุดระบายน้ำทิ้ง',
          eligibleParameters: ['BOD (mg/l)', 'COD (mg/l)'],
        },
      ],
    });

    expect(result.points).toHaveLength(2);
    expect(result.points[0]).toMatchObject({
      systemType: 'CEMS',
      exemptedParameters: [],
      connectedParameters: [],
      pendingParameters: [],
      details: null,
    });
  });

  it('rejects forms without monitoring points', () => {
    const result = saveMonitoringPointFormSchema.safeParse({
      factory: {
        factoryName: 'สถานีบ่มใบยาสบหนอง',
        factoryRegistrationNoNew: '10520000225172',
      },
      points: [],
    });

    expect(result.success).toBe(false);
  });

  it('rejects unknown system types', () => {
    const result = saveMonitoringPointFormSchema.safeParse({
      factory: {
        factoryName: 'สถานีบ่มใบยาสบหนอง',
        factoryRegistrationNoNew: '10520000225172',
      },
      points: [
        {
          systemType: 'MOBILE',
          pointName: 'จุดทดสอบ',
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
