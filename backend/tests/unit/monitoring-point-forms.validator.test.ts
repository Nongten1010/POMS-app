import { describe, expect, it } from '@jest/globals';
import { saveMonitoringPointFormSchema } from '../../src/modules/monitoring-point-forms/monitoring-point-forms.validator';

const cemsAnnexRequiredBy = [
  'ประกาศกระทรวงอุตสาหกรรม เรื่อง กำหนดให้โรงงานต้องติดตั้งเครื่องมือหรือเครื่องอุปกรณ์พิเศษเพื่อรายงานมลพิษอากาศจากปล่องโรงงาน พ.ศ. 2565',
  'ประกาศกระทรวงอุตสาหกรรม เรื่อง กำหนดให้โรงงานในท้องที่กรุงเทพมหานครต้องติดตั้งเครื่องมือหรือเครื่องอุปกรณ์พิเศษเพื่อรายงานมลพิษอากาศจากปล่องโรงงาน พ.ศ. 2569',
] as const;

describe('monitoring point form validator', () => {
  it('accepts and preserves project fields when EIA is Other', () => {
    const result = saveMonitoringPointFormSchema.parse({
      factory: {
        eiaInfo: 'อื่นๆ',
        eiaOther: 'รายงานสิ่งแวดล้อมประเภทเฉพาะ',
        projectName: 'โครงการปรับปรุงระบบตรวจวัด',
      },
      points: [],
    });

    expect(result.factory).toMatchObject({
      eiaInfo: 'อื่นๆ',
      eiaOther: 'รายงานสิ่งแวดล้อมประเภทเฉพาะ',
      projectName: 'โครงการปรับปรุงระบบตรวจวัด',
    });
  });

  it('requires an EIA detail when EIA is Other', () => {
    const result = saveMonitoringPointFormSchema.safeParse({
      factory: {
        eiaInfo: 'อื่นๆ',
        eiaOther: '   ',
      },
      points: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: ['factory', 'eiaOther'] })]),
      );
    }
  });

  it('normalizes an EIA detail to null when EIA is not Other', () => {
    const result = saveMonitoringPointFormSchema.parse({
      factory: {
        eiaInfo: 'มี EIA',
        eiaOther: 'ข้อความที่ไม่ควรถูกบันทึก',
      },
      points: [],
    });

    expect(result.factory.eiaOther).toBeNull();
  });

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
          cemsInstallationRequiredBy: cemsAnnexRequiredBy[0],
          legalAnnexNo: ['1', '3'],
          eligibleParameters: ['NOx (ppm)', 'SO2 (ppm)'],
          primaryFuel: 'ก๊าซธรรมชาติ',
          primaryFuelOther: 'ชีวมวล',
          secondaryFuel: 'น้ำมันเตา',
          secondaryFuelOther: 'ก๊าซชีวภาพ',
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
      legalAnnexNo: ['1', '3'],
      primaryFuelOther: 'ชีวมวล',
      secondaryFuelOther: 'ก๊าซชีวภาพ',
      exemptedParameters: [],
      connectedParameters: [],
      pendingParameters: [],
      details: null,
    });
    expect(result.points[1]?.legalAnnexNo).toEqual([]);
  });

  it('accepts forms without monitoring points', () => {
    const result = saveMonitoringPointFormSchema.parse({
      factory: {
        factoryName: '',
        factoryRegistrationNoNew: '',
      },
      points: [],
    });

    expect(result.factory.factoryName).toBeNull();
    expect(result.factory.factoryRegistrationNoNew).toBeNull();
    expect(result.points).toEqual([]);
  });

  it('accepts factory coordinates within valid latitude and longitude ranges', () => {
    const result = saveMonitoringPointFormSchema.parse({
      factory: {
        factoryName: 'สถานีบ่มใบยาสบหนอง',
        factoryRegistrationNoNew: '10520000225172',
        latitude: '18.29512',
        longitude: '99.50672',
      },
      points: [],
    });

    expect(result.factory.latitude).toBe(18.29512);
    expect(result.factory.longitude).toBe(99.50672);
  });

  it('rejects factory coordinates outside valid latitude and longitude ranges', () => {
    const result = saveMonitoringPointFormSchema.safeParse({
      factory: {
        factoryName: 'สถานีบ่มใบยาสบหนอง',
        factoryRegistrationNoNew: '10520000225172',
        latitude: 91,
        longitude: 181,
      },
      points: [],
    });

    expect(result.success).toBe(false);
  });

  it('accepts blank monitoring point fields', () => {
    const result = saveMonitoringPointFormSchema.parse({
      factory: {},
      points: [
        {
          systemType: 'CEMS',
          pointCode: '',
          pointName: '',
          productionUnitType: '',
          productionCapacity: '',
        },
      ],
    });

    expect(result.points[0]).toMatchObject({
      pointCode: null,
      pointName: null,
      productionUnitType: null,
      productionCapacity: null,
    });
  });

  it('ignores blank values in multiselect arrays', () => {
    const result = saveMonitoringPointFormSchema.parse({
      factory: {
        factoryName: 'สถานีบ่มใบยาสบหนอง',
        factoryRegistrationNoNew: '10520000225172',
      },
      points: [
        {
          systemType: 'CEMS',
          pointName: 'ปล่องหลัก',
          cemsInstallationRequiredBy: cemsAnnexRequiredBy[0],
          legalAnnexNo: ['', '1', '  ', '3'],
          eligibleParameters: ['', 'NOx (ppm)', '  '],
          exemptedParameters: [''],
          connectedParameters: ['O2 (%)', ''],
          pendingParameters: ['', 'SO2 (ppm)'],
        },
      ],
    });

    expect(result.points[0]?.legalAnnexNo).toEqual(['1', '3']);
    expect(result.points[0]?.eligibleParameters).toEqual(['NOx (ppm)']);
    expect(result.points[0]?.exemptedParameters).toEqual([]);
    expect(result.points[0]?.connectedParameters).toEqual(['O2 (%)']);
    expect(result.points[0]?.pendingParameters).toEqual(['SO2 (ppm)']);
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

  it.each(cemsAnnexRequiredBy)(
    'accepts legal annex numbers for the eligible CEMS announcement: %s',
    (cemsInstallationRequiredBy) => {
      const result = saveMonitoringPointFormSchema.safeParse({
        factory: {},
        points: [
          {
            systemType: 'CEMS',
            cemsInstallationRequiredBy,
            legalAnnexNo: ['1'],
          },
        ],
      });

      expect(result.success).toBe(true);
    },
  );

  it('rejects legal annex numbers for a CEMS announcement that does not use the annex list', () => {
    const result = saveMonitoringPointFormSchema.safeParse({
      factory: {},
      points: [
        {
          systemType: 'CEMS',
          cemsInstallationRequiredBy:
            'ระเบียบคณะกรรมการกำกับกิจการพลังงานว่าด้วยหลักเกณฑ์การจัดทำรายงานประมวลหลักการปฏิบัติ และรายงานผลการปฏิบัติตามประมวลหลักการปฏิบัติ สำหรับการประกอบกิจการผลิตไฟฟ้า พ.ศ. 2565',
          legalAnnexNo: ['1'],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects legal annex numbers for WPMS points', () => {
    const result = saveMonitoringPointFormSchema.safeParse({
      factory: {},
      points: [
        {
          systemType: 'WPMS',
          legalAnnexNo: ['1'],
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
