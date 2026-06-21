import { describe, expect, it } from '@jest/globals';
import {
  diwFactoryFlagFromOperationStatus,
  diwProvinceCodeFromName,
  toEligibleFactoryCandidate,
  type FacImportRow,
} from '../../src/modules/eligible-factories/fac-import.mapper';

describe('fac_import mapper', () => {
  const row: FacImportRow = {
    FACREG: ' 06406304517',
    FACREQ: '31/12/2547',
    FFLAG: 1,
    EXPSEQ: null,
    FNAME: 'ห้างหุ้นส่วนจำกัด โรงกลึงก๊กกวง',
    FADDR: '50/10-11-12',
    FMOO: null,
    SOI: 'บรมบรรพต',
    ROAD: 'บริพัตร',
    PROV: 10,
    CANAL: '-',
    RIVER: '-',
    OBJECT: 'ทำผลิตภัณฑ์โลหะต่าง ๆ',
    HP: 75,
    HP2: null,
    OLDREG: '08',
    CAPLAND: 0,
    CAPBUILD: 75000,
    CAPMACH: 250000,
    CAPWORK: 1500000,
    COLONY_INDUST_CODE: null,
    STARTDATE: '1974-08-08',
    DISPFACREG: '3-64(6)-45/17',
    LONGITUDE_X: 663314,
    LATITUDE_Y: 1520765,
    CAPPROD: null,
    TOTAL_CAP: null,
    CAPREGIS: null,
    FID: '10100302325234',
    FACTYPE: '064065',
    CLASS: '000064',
  };

  it('maps fac_import columns to eligible factory candidate fields', () => {
    const result = toEligibleFactoryCandidate(row);

    expect(result).toMatchObject({
      factoryName: 'ห้างหุ้นส่วนจำกัด โรงกลึงก๊กกวง',
      factoryId: '10100302325234',
      factoryRegistrationNo: '3-64(6)-45/17',
      factoryClass: '064',
      factorySubclass: '065',
      provinceName: 'กรุงเทพมหานคร',
      businessActivity: 'ทำผลิตภัณฑ์โลหะต่าง ๆ',
      operationStatus: 'แจ้งประกอบแล้ว',
      machineryHorsepower: 75,
      eia: 'ไม่มี',
      hasEia: false,
    });
  });

  it('splits multiple subclass codes and removes the duplicated main code', () => {
    const result = toEligibleFactoryCandidate({
      ...row,
      CLASS: '101',
      SUBCLASS: '101102103',
      FACTYPE: null,
    });

    expect(result.factoryClass).toBe('101');
    expect(result.factorySubclass).toBe('102,103');
  });

  it('uses industrial estate display names when the source code has a lookup match', () => {
    const result = toEligibleFactoryCandidate(
      {
        ...row,
        COLONY_INDUST_CODE: 'BP',
      },
      { industrialEstateNamesByCode: new Map([['BP', 'นิคมอุตสาหกรรมบางปู']]) },
    );

    expect(result.industrialEstateName).toBe('นิคมอุตสาหกรรมบางปู');
  });

  it('does not expose projected coordinate values as latitude/longitude', () => {
    const result = toEligibleFactoryCandidate(row);

    expect(result.latitude).toBeNull();
    expect(result.longitude).toBeNull();
  });

  it('maps WGS84 coordinates even when the source column values are swapped', () => {
    const result = toEligibleFactoryCandidate({
      ...row,
      LONGITUDE_X: 13.544012,
      LATITUDE_Y: 100.65241,
    });

    expect(result.latitude).toBe(13.544012);
    expect(result.longitude).toBe(100.65241);
  });

  it('does not expose zero coordinates as latitude/longitude', () => {
    const result = toEligibleFactoryCandidate({
      ...row,
      LONGITUDE_X: 0,
      LATITUDE_Y: 0,
    });

    expect(result.latitude).toBeNull();
    expect(result.longitude).toBeNull();
  });

  it('returns exactly the 20 DataDict_Fac60k candidate fields', () => {
    const result = toEligibleFactoryCandidate(row);

    expect(Object.keys(result).sort()).toEqual(
      [
        'address',
        'boilerSizeEach',
        'businessActivity',
        'eia',
        'factoryClass',
        'factoryId',
        'factoryName',
        'factoryRegistrationNo',
        'factorySubclass',
        'fuelUsed',
        'hasEia',
        'industrialEstateName',
        'latitude',
        'longitude',
        'machineryHorsepower',
        'operationStatus',
        'productionCapacity',
        'provinceName',
      ].sort(),
    );
  });

  it('maps supported province and operation status filters back to DIW codes', () => {
    expect(diwProvinceCodeFromName('ระยอง')).toBe('21');
    expect(diwFactoryFlagFromOperationStatus('แจ้งประกอบแล้ว')).toBe('1');
    expect(diwFactoryFlagFromOperationStatus('หยุดชั่วคราว')).toBe('3');
    expect(diwFactoryFlagFromOperationStatus('ยกเลิก')).toBeNull();
  });

  it('maps temporary stopped Fac60k status from FFLAG 3', () => {
    const result = toEligibleFactoryCandidate({
      ...row,
      FFLAG: 3,
    });

    expect(result.operationStatus).toBe('หยุดชั่วคราว');
  });
});
