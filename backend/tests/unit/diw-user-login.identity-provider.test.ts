import { describe, expect, it, jest } from '@jest/globals';
import {
  DiwUserLoginIdentityProvider,
  parseDiwOfficerLoginResponse,
  parseDiwOperatorLoginResponse,
} from '../../src/modules/auth/identity-provider/diw-user-login.identity-provider';

jest.mock('../../src/config/logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

describe('parseDiwOfficerLoginResponse', () => {
  it('maps DIW DPIS UserLogin msg into an officer profile', () => {
    const result = parseDiwOfficerLoginResponse({
      status: 'true',
      msg: JSON.stringify([
        {
          organize_id: '3010089',
          organize_th: 'ฝ่ายบริหารทั่วไป',
          percardno: '1234567890123',
          prename_th: 'นางสาว',
          per_name: 'สมหญิง',
          per_surname: 'ทดสอบ',
          pos_no: '2071',
          pertype_id: '99',
          pertype: 'พนักงานจ้างเหมาบริการ',
          positiontype_id: '12',
          positiontype_th: 'งานสนับสนุน',
          line_id: '',
          linename_th: 'พนักงานจ้างเหมาบริการ',
          level_id: '',
          levelname_th: 'ลูกจ้างเหมา',
          division_id: '3010088',
          department_id: '3010000',
          ministry_id: '22',
          province_id: '1000',
          per_status: '1',
          per_status_name: 'ปกติ',
        },
      ]),
    });

    expect(result).toEqual({
      external_id: '1234567890123',
      prename_th: 'นางสาว',
      first_name: 'สมหญิง',
      last_name: 'ทดสอบ',
      email: null,
      phone: null,
      pos_no: '2071',
      pertype_id: '99',
      pertype: 'พนักงานจ้างเหมาบริการ',
      position_type_id: '12',
      position_type_th: 'งานสนับสนุน',
      line_id: '',
      line_name_th: 'พนักงานจ้างเหมาบริการ',
      level_id: '',
      level_name_th: 'ลูกจ้างเหมา',
      mposition_id: '',
      mposition: '',
      organize_id: '3010089',
      division_id: '3010088',
      department_id: '3010000',
      ministry_id: '22',
      province_id: '1000',
      per_status: '1',
      per_status_name: 'ปกติ',
      relocation_type: '',
      relocation_name: '',
    });
  });

  it('rejects unsuccessful DIW DPIS login responses', () => {
    expect(parseDiwOfficerLoginResponse({ status: 'false', msg: '[]' })).toBeNull();
  });
});

describe('parseDiwOperatorLoginResponse', () => {
  it('maps DIW UserLogin response into an operator profile', () => {
    const result = parseDiwOperatorLoginResponse(
      [
        {
          citizen_id: '1234567890123',
          status: 'true',
          userCode: 'U001',
          userFirstName: 'สมชาย',
          userLastName: 'ทดสอบ',
          userPhone: '0999999999',
          userEmail: 'operator@example.com',
          userRegisDate: '2026-06-23',
          juristic: JSON.stringify([
            {
              JuristicID: '01055523002118',
              JuristicNameTh: 'บริษัท ทดสอบ จำกัด',
              JuristicNameEn: 'TEST COMPANY LIMITED',
              FactoryList: [
                {
                  FID: '10100008325355',
                  CODE: '3-28(1)-83/35',
                  FNAME: 'โรงงานทดสอบ',
                },
              ],
            },
          ]),
        },
      ],
      '1000',
    );

    expect(result).toEqual({
      citizen_id: '1234567890123',
      user_code: 'U001',
      first_name: 'สมชาย',
      last_name: 'ทดสอบ',
      email: 'operator@example.com',
      phone: '0999999999',
      regis_date: '2026-06-23',
      juristics: [
        {
          juristic_id: '01055523002118',
          name_th: 'บริษัท ทดสอบ จำกัด',
          name_en: 'TEST COMPANY LIMITED',
          factories: [
            {
              fid: '10100008325355',
              code: '3-28(1)-83/35',
              name: 'โรงงานทดสอบ',
              province_id: '1000',
              system_id: null,
              verify_status: 0,
              authorize_start: null,
              authorize_end: null,
              juristic_start: null,
              verify_date: null,
            },
          ],
        },
      ],
    });
  });

  it('rejects unsuccessful DIW login responses', () => {
    expect(parseDiwOperatorLoginResponse([{ status: 'false' }], '1000')).toBeNull();
  });
});

describe('DiwUserLoginIdentityProvider', () => {
  it('posts clientId, username, and password to DIW UserLogin', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => [
        {
          citizen_id: '1234567890123',
          status: true,
          userFirstName: 'สมชาย',
          userLastName: 'ทดสอบ',
          juristic: '[]',
        },
      ],
    })) as unknown as typeof fetch;

    const provider = new DiwUserLoginIdentityProvider({
      operatorUrl: 'https://diwws.diw.go.th/ulogin/v1/UserLogin',
      officerUrl: 'https://diwws.diw.go.th/idiwdpislogin/v1/UserLogin',
      clientId: 'test-client-id',
      timeoutMs: 1000,
      defaultProvinceId: '1000',
      fetchImpl,
    });

    const result = await provider.authenticateOperator('operator_user', 'secret-password');

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://diwws.diw.go.th/ulogin/v1/UserLogin',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json;charset=UTF-8',
        },
        body: JSON.stringify({
          clientId: 'test-client-id',
          username: 'operator_user',
          password: 'secret-password',
        }),
      }),
    );
    expect(result).toMatchObject({
      citizen_id: '1234567890123',
      first_name: 'สมชาย',
      last_name: 'ทดสอบ',
    });
  });

  it('posts departmentID to DIW DPIS UserLogin for officer login', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        status: true,
        msg: JSON.stringify([
          {
            per_cardno: '1234567890123',
            per_name: 'สมหญิง',
            per_surname: 'ทดสอบ',
          },
        ]),
      }),
    })) as unknown as typeof fetch;

    const provider = new DiwUserLoginIdentityProvider({
      operatorUrl: 'https://diwws.diw.go.th/ulogin/v1/UserLogin',
      officerUrl: 'https://diwws.diw.go.th/idiwdpislogin/v1/UserLogin',
      clientId: 'test-client-id',
      timeoutMs: 1000,
      defaultProvinceId: '1000',
      fetchImpl,
    });

    const result = await provider.authenticateOfficer('officer_user', 'secret-password', '2');

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://diwws.diw.go.th/idiwdpislogin/v1/UserLogin',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          clientId: 'test-client-id',
          username: 'officer_user',
          password: 'secret-password',
          departmentID: '2',
        }),
      }),
    );
    expect(result).toMatchObject({
      external_id: '1234567890123',
      first_name: 'สมหญิง',
      last_name: 'ทดสอบ',
    });
  });
});
