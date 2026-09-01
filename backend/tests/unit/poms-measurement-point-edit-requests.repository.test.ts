import { describe, expect, it } from '@jest/globals';
import { buildApprovedMeasurementPointWritePatchForTests } from '../../src/modules/poms-factories/poms-factories.repository';

describe('POMS measurement-point approval patch', () => {
  it('updates only the editable live-point columns and preserves every identity/parameter column', () => {
    const patch = buildApprovedMeasurementPointWritePatchForTests({
      connectedPointId: 15,
      sourceMeasurementPointId: 2,
      eligibleFactoryId: 7,
      factoryId: 'factory-001',
      factoryName: 'บริษัท ทดสอบ จำกัด',
      systemType: 'CEMS',
      pointName: 'ปล่อง A (แก้ไข)',
      pointCode: 'S0001',
      pointType: 'STACK',
      parameters: ['CO (ppm)'],
      monitoringPointStatus: 'อยู่ระหว่างเชื่อมต่อ',
      details: { stackHeight: 35 },
      documentsAndImages: [
        {
          title: 'ภาพจุดตรวจวัด',
          fileName: 'stack-a.jpg',
          fileUrl: 'https://example.com/stack-a.jpg',
          fileType: 'image/jpeg',
          fileSize: 1024,
        },
      ],
      measurementInstruments: {
        converterBrand: 'Acme',
        converterModel: 'C100',
        parameters: [{ parameter: 'CO (ppm)' }],
      },
      updatedAt: '2026-09-01T00:00:00.000Z',
    });

    expect(patch).toEqual({
      point_name: 'ปล่อง A (แก้ไข)',
      monitoring_point_status: 'อยู่ระหว่างเชื่อมต่อ',
      details_json: JSON.stringify({ stackHeight: 35 }),
      documents_json: JSON.stringify([
        {
          title: 'ภาพจุดตรวจวัด',
          fileName: 'stack-a.jpg',
          fileUrl: 'https://example.com/stack-a.jpg',
          fileType: 'image/jpeg',
          fileSize: 1024,
        },
      ]),
      instruments_json: JSON.stringify({
        converterBrand: 'Acme',
        converterModel: 'C100',
        parameters: [{ parameter: 'CO (ppm)' }],
      }),
    });
    expect(patch).not.toHaveProperty('point_code');
    expect(patch).not.toHaveProperty('point_type');
    expect(patch).not.toHaveProperty('parameters_json');
    expect(patch).not.toHaveProperty('system_type');
    expect(patch).not.toHaveProperty('source_measurement_point_id');
    expect(patch).not.toHaveProperty('eligible_factory_id');
    expect(patch).not.toHaveProperty('factory_id');
  });

  it('supports explicit clears without introducing immutable columns', () => {
    const patch = buildApprovedMeasurementPointWritePatchForTests({
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
    });

    expect(patch).toEqual({
      point_name: 'ปล่อง A',
      monitoring_point_status: null,
      details_json: null,
      documents_json: null,
      instruments_json: null,
    });
  });
});
