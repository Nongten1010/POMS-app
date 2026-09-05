import { describe, expect, it } from '@jest/globals';
import {
  createPomsFactoryEditRequestSchema,
  resubmitPomsFactoryEditRequestSchema,
  reviewPomsFactoryEditRequestSchema,
} from '../../src/modules/poms-factories/poms-factories.validator';

const frontPhoto = {
  title: 'ภาพด้านหน้าโรงงาน',
  fileName: 'factory-front.jpg',
  fileUrl: 'https://example.com/uploads/factory-front.jpg',
  fileType: 'image/jpeg',
  fileSize: 1024,
};

const factoryLogo = {
  title: 'โลโก้โรงงาน',
  fileName: 'factory-logo.png',
  fileUrl: 'https://example.com/uploads/factory-logo.png',
  fileType: 'image/png',
  fileSize: 512,
};

describe.each([
  ['create', createPomsFactoryEditRequestSchema],
  ['resubmit', resubmitPomsFactoryEditRequestSchema],
])('POMS basic-info %s validator', (_operation, schema) => {
  it('accepts all seven editable fields without factory identity or a request note', () => {
    const result = schema.safeParse({
      formType: 'BASIC_INFO',
      latitude: 12.7,
      longitude: 101.1,
      eia: 'อื่นๆ',
      eiaOther: '  รายงานประเภทเฉพาะ  ',
      projectName: '  โครงการใหม่  ',
      factoryFrontPhotos: [frontPhoto],
      factoryLogo,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({
      formType: 'BASIC_INFO',
      latitude: 12.7,
      longitude: 101.1,
      eia: 'อื่นๆ',
      eiaOther: 'รายงานประเภทเฉพาะ',
      projectName: 'โครงการใหม่',
      factoryFrontPhotos: [expect.objectContaining(frontPhoto)],
      factoryLogo: expect.objectContaining(factoryLogo),
    });
  });

  it('preserves omitted values when only the project name is supplied', () => {
    expect(schema.parse({ projectName: 'โครงการใหม่' })).toEqual({
      projectName: 'โครงการใหม่',
    });
  });

  it('preserves explicit clears for all editable fields', () => {
    const payload = {
      latitude: null,
      longitude: null,
      eia: null,
      eiaOther: null,
      projectName: null,
      factoryFrontPhotos: [],
      factoryLogo: null,
    };
    expect(schema.parse(payload)).toEqual(payload);
  });

  it.each([{}, { formType: 'BASIC_INFO' }])('rejects an empty patch %j', (payload) => {
    expect(schema.safeParse(payload).success).toBe(false);
  });

  it.each([
    'factoryName',
    'factoryAddress',
    'address',
    'remarks',
    'note',
    'factoryId',
    'factoryRegistrationNo',
    'businessActivity',
    'measurementPoints',
    'status',
  ])('rejects the forbidden field %s even alongside an allowed change', (field) => {
    expect(
      schema.safeParse({
        projectName: 'โครงการใหม่',
        [field]: field === 'measurementPoints' ? [] : 'ห้ามแก้',
      }).success,
    ).toBe(false);
  });

  it.each([
    { latitude: 12.7 },
    { longitude: 101.1 },
    { latitude: null, longitude: 101.1 },
    { latitude: 91, longitude: 101.1 },
    { latitude: 12.7, longitude: 181 },
  ])('rejects incomplete or invalid coordinates %j', (payload) => {
    expect(schema.safeParse(payload).success).toBe(false);
  });

  it.each([
    { eia: 'อื่นๆ' },
    { eia: 'อื่นๆ', eiaOther: '   ' },
    { eia: 'มี EIA', eiaOther: 'รายงานประเภทเฉพาะ' },
    { eiaOther: 'รายงานประเภทเฉพาะ' },
  ])('retains the EIA other-text validation for %j', (payload) => {
    expect(schema.safeParse(payload).success).toBe(false);
  });
});

describe('POMS factory edit request validators', () => {
  it('retains the remarks alias for the measurement-point form', () => {
    expect(
      createPomsFactoryEditRequestSchema.parse({
        formType: 'MEASUREMENT_POINTS',
        measurementPoints: [{ connectedPointId: 15, pointName: 'ปล่อง A' }],
        remarks: 'แก้ไขตามเอกสารล่าสุด',
      }),
    ).toEqual({
      formType: 'MEASUREMENT_POINTS',
      measurementPoints: [{ connectedPointId: 15, pointName: 'ปล่อง A' }],
      note: 'แก้ไขตามเอกสารล่าสุด',
    });
    expect(
      createPomsFactoryEditRequestSchema.safeParse({
        formType: 'MEASUREMENT_POINTS',
        measurementPoints: [{ connectedPointId: 15, pointName: 'ปล่อง A' }],
        remarks: 'ข้อความใหม่',
        note: 'ข้อความเดิม',
      }).success,
    ).toBe(false);
  });

  it('accepts the measurement-point edit form with unique connectedPointId values', () => {
    const result = createPomsFactoryEditRequestSchema.safeParse({
      formType: 'MEASUREMENT_POINTS',
      measurementPoints: [
        {
          connectedPointId: 15,
          pointName: 'ปล่อง A (แก้ไข)',
          monitoringPointStatus: 'อยู่ระหว่างเชื่อมต่อ',
        },
      ],
      note: 'ขอแก้ไขข้อมูลจุดตรวจวัด',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      formType: 'MEASUREMENT_POINTS',
      measurementPoints: [
        expect.objectContaining({
          connectedPointId: 15,
          pointName: 'ปล่อง A (แก้ไข)',
          monitoringPointStatus: 'อยู่ระหว่างเชื่อมต่อ',
        }),
      ],
    });
  });

  it('rejects duplicate connectedPointId values in one measurement-point request', () => {
    expect(
      createPomsFactoryEditRequestSchema.safeParse({
        formType: 'MEASUREMENT_POINTS',
        measurementPoints: [
          { connectedPointId: 15, pointName: 'ปล่อง A' },
          { connectedPointId: 15, monitoringPointStatus: 'อยู่ระหว่างเชื่อมต่อ' },
        ],
      }).success,
    ).toBe(false);
  });

  it('requires at least one editable measurement-point field beyond connectedPointId', () => {
    expect(
      createPomsFactoryEditRequestSchema.safeParse({
        formType: 'MEASUREMENT_POINTS',
        measurementPoints: [{ connectedPointId: 15 }],
      }).success,
    ).toBe(false);
  });

  it('accepts a measurement-point patch that changes only status', () => {
    expect(
      createPomsFactoryEditRequestSchema.safeParse({
        formType: 'MEASUREMENT_POINTS',
        measurementPoints: [{ connectedPointId: 15, monitoringPointStatus: 'เชื่อมต่อครบแล้ว' }],
      }).success,
    ).toBe(true);
  });

  it.each(['pointCode', 'parameters', 'pointType', 'systemType'])(
    'rejects immutable measurement-point field %s',
    (field) => {
      expect(
        createPomsFactoryEditRequestSchema.safeParse({
          formType: 'MEASUREMENT_POINTS',
          measurementPoints: [
            {
              connectedPointId: 15,
              pointName: 'ปล่อง A',
              [field]: field === 'parameters' ? ['CO (ppm)'] : 'ห้ามแก้',
            },
          ],
        }).success,
      ).toBe(false);
    },
  );

  it('requires a revision reason for REQUEST_REVISION', () => {
    expect(
      reviewPomsFactoryEditRequestSchema.safeParse({
        decision: 'REQUEST_REVISION',
      }).success,
    ).toBe(false);
    expect(
      reviewPomsFactoryEditRequestSchema.safeParse({
        decision: 'REQUEST_REVISION',
        revisionReason: 'กรุณาแนบภาพด้านหน้าใหม่',
        officerNote: 'รอตรวจอีกครั้ง',
      }).success,
    ).toBe(true);
  });

  it('requires an officer note for REJECT', () => {
    expect(
      reviewPomsFactoryEditRequestSchema.safeParse({
        decision: 'REJECT',
      }).success,
    ).toBe(false);
  });

  it.each(['APPROVE', 'REJECT'] as const)('accepts final review decision %s', (decision) => {
    expect(
      reviewPomsFactoryEditRequestSchema.safeParse({
        decision,
        officerNote: decision === 'REJECT' ? 'ข้อมูลไม่ตรงกับหลักฐาน' : 'ข้อมูลครบถ้วน',
      }).success,
    ).toBe(true);
  });
});
