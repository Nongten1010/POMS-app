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

describe('POMS factory edit request validators', () => {
  it('accepts only the editable factory-profile fields and preserves explicit clears', () => {
    const result = createPomsFactoryEditRequestSchema.safeParse({
      factoryName: '  บริษัท ทดสอบ จำกัด (ใหม่)  ',
      factoryAddress: null,
      latitude: 12.7,
      longitude: 101.1,
      eia: 'มี EIA',
      eiaOther: null,
      projectName: null,
      factoryFrontPhotos: [frontPhoto],
      factoryLogo,
      note: 'ขอแก้ไขข้อมูลพื้นฐาน',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      factoryName: 'บริษัท ทดสอบ จำกัด (ใหม่)',
      factoryAddress: null,
      latitude: 12.7,
      longitude: 101.1,
      projectName: null,
      factoryFrontPhotos: [expect.objectContaining({ fileName: 'factory-front.jpg' })],
      factoryLogo: expect.objectContaining({ fileName: 'factory-logo.png' }),
    });
  });

  it('keeps omitted patch fields omitted so they retain the current value', () => {
    const result = createPomsFactoryEditRequestSchema.safeParse({
      factoryName: 'บริษัท ทดสอบ จำกัด',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(Object.prototype.hasOwnProperty.call(result.data, 'factoryAddress')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(result.data, 'factoryLogo')).toBe(false);
  });

  it('requires latitude and longitude to be supplied or cleared as a pair', () => {
    expect(
      createPomsFactoryEditRequestSchema.safeParse({
        factoryName: 'บริษัท ทดสอบ จำกัด',
        latitude: 12.7,
      }).success,
    ).toBe(false);
    expect(
      createPomsFactoryEditRequestSchema.safeParse({
        factoryName: 'บริษัท ทดสอบ จำกัด',
        latitude: null,
        longitude: null,
      }).success,
    ).toBe(true);
  });

  it('requires eiaOther only when eia is อื่นๆ', () => {
    expect(
      createPomsFactoryEditRequestSchema.safeParse({
        factoryName: 'บริษัท ทดสอบ จำกัด',
        eia: 'อื่นๆ',
      }).success,
    ).toBe(false);
    expect(
      createPomsFactoryEditRequestSchema.safeParse({
        factoryName: 'บริษัท ทดสอบ จำกัด',
        eia: 'อื่นๆ',
        eiaOther: 'รายงานประเภทเฉพาะ',
      }).success,
    ).toBe(true);
  });

  it.each(['factoryRegistrationNo', 'businessActivity', 'measurementPoints', 'status'])(
    'rejects immutable or out-of-scope field %s',
    (field) => {
      const result = createPomsFactoryEditRequestSchema.safeParse({
        factoryName: 'บริษัท ทดสอบ จำกัด',
        [field]: field === 'measurementPoints' ? [] : 'ห้ามแก้',
      });

      expect(result.success).toBe(false);
    },
  );

  it('uses the same editable profile contract for resubmission', () => {
    const result = resubmitPomsFactoryEditRequestSchema.safeParse({
      factoryName: 'บริษัท ทดสอบ จำกัด (แก้ไขรอบ 2)',
      factoryFrontPhotos: [],
      factoryLogo: null,
      note: 'แก้ไขตามข้อสังเกตแล้ว',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.factoryFrontPhotos).toEqual([]);
    expect(result.data.factoryLogo).toBeNull();
  });

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
