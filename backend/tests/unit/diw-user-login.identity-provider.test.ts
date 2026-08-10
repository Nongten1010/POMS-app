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
  it('keeps U-code and 13-digit logins separate even when upstream returns one person number', () => {
    const response = {
      status: 'true',
      msg: JSON.stringify([
        {
          percardno: '9999999999999',
          per_name: 'เจ้าหน้าที่',
          per_surname: 'ทดสอบ',
        },
      ]),
    };

    const dpis = parseDiwOfficerLoginResponse(response, 'U100');
    const iIndustry = parseDiwOfficerLoginResponse(response, '1111111111111');

    expect(dpis).toMatchObject({ identity_provider: 'diw_dpis', external_id: 'U100' });
    expect(iIndustry).toMatchObject({
      identity_provider: 'i_industry',
      external_id: '1111111111111',
    });
  });

  it('maps DIW DPIS UserLogin msg into an officer profile', () => {
    const result = parseDiwOfficerLoginResponse(
      {
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
      },
      'U100',
    );

    expect(result).toEqual({
      identity_provider: 'diw_dpis',
      external_id: 'U100',
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
      organize_name_th: 'ฝ่ายบริหารทั่วไป',
      division_name_th: '',
      department_id: '3010000',
      department_name_th: '',
      ministry_id: '22',
      province_id: '1000',
      per_status: '1',
      per_status_name: 'ปกติ',
      relocation_type: '',
      relocation_name: '',
    });
  });

  it('maps the live IEAT V2 officer names while preserving leading-zero organization codes', () => {
    const result = parseDiwOfficerLoginResponse(
      {
        status: 'true',
        msg: JSON.stringify([
          {
            percardno: '1111111111111',
            prename_th: 'นาย',
            per_name: 'ทดสอบกนอ',
            per_surname: 'ระบบ',
            levelname_th: '5',
            mposition: 'วิศวกร',
            organize_id: '40100',
            organize_th: 'ฝ่ายบริการผู้ประกอบกิจการ',
            division_id: '40101',
            division: 'กองอนุญาตผู้ประกอบกิจการ',
            department_id: '01000',
            department: 'การนิคมอุตสาหกรรมแห่งประเทศไทย',
          },
        ]),
      },
      '1111111111111',
    );

    expect(result).toMatchObject({
      external_id: '1111111111111',
      identity_provider: 'i_industry',
      mposition: 'วิศวกร',
      organize_id: '40100',
      organize_name_th: 'ฝ่ายบริการผู้ประกอบกิจการ',
      division_name_th: 'กองอนุญาตผู้ประกอบกิจการ',
      department_id: '01000',
      department_name_th: 'การนิคมอุตสาหกรรมแห่งประเทศไทย',
    });
  });

  it('accepts per_cardno and does not store a V2 organization name as division_id', () => {
    const result = parseDiwOfficerLoginResponse(
      {
        status: 'true',
        msg: JSON.stringify([
          {
            per_cardno: '2222222222222',
            prename_th: 'นาย',
            per_name: 'ทดสอบกรอ',
            per_surname: 'ระบบ',
            levelname_th: 'ชำนาญการ',
            mposition: '',
            organize_id: '3010065',
            organize_th: 'กลุ่มเฝ้าระวังและเตือนภัยมลพิษโรงงาน',
            division_id: 'กลุ่มเฝ้าระวังและเตือนภัยมลพิษโรงงาน',
            division: 'กองวิจัยและเตือนภัยมลพิษโรงงาน ',
            department_id: '3010000',
            department: 'กรมโรงงานอุตสาหกรรม',
          },
        ]),
      },
      'U200',
    );

    expect(result).toMatchObject({
      external_id: 'U200',
      identity_provider: 'diw_dpis',
      organize_id: '3010065',
      organize_name_th: 'กลุ่มเฝ้าระวังและเตือนภัยมลพิษโรงงาน',
      division_name_th: 'กองวิจัยและเตือนภัยมลพิษโรงงาน',
      department_id: '3010000',
      department_name_th: 'กรมโรงงานอุตสาหกรรม',
    });
  });

  it('rejects unsuccessful DIW DPIS login responses', () => {
    expect(parseDiwOfficerLoginResponse({ status: 'false', msg: '[]' }, 'U200')).toBeNull();
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
      '1234567890123',
    );

    expect(result).toEqual({
      identity_provider: 'i_industry',
      external_id: '1234567890123',
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

  it('supports production-style JuristicList payloads with lowercase factory keys', () => {
    const result = parseDiwOperatorLoginResponse(
      [
        {
          citizen_id: '3333333333333',
          status: 'true',
          userCode: 'OP-004',
          userFirstName: 'ผู้ประกอบการ',
          userLastName: 'ตัวอย่าง',
          userPhone: '0800000000',
          userEmail: 'operator@example.test',
          userRegisDate: '10/08/2026 12:01:53',
          JuristicList: JSON.stringify([
            {
              JuristicID: '0100000000001',
              JuristicNameTh: 'บริษัท ทดสอบ จำกัด',
              JuristicNameEn: 'TEST COMPANY LIMITED',
              FactoryList: [
                {
                  fid: '10100000000001',
                  code: 'TEST-001',
                  fname: 'โรงงานทดสอบ',
                  system_id: '12',
                  verify_status: '1',
                  authorize_start: '2024-09-02',
                  authorize_end: '2024-09-30',
                  juristic_start: '2024-08-05',
                  verify_date: '2024-09-13',
                },
              ],
            },
          ]),
        },
      ],
      '1000',
      '3333333333333',
    );

    expect(result).toEqual({
      identity_provider: 'i_industry',
      external_id: '3333333333333',
      citizen_id: '3333333333333',
      user_code: 'OP-004',
      first_name: 'ผู้ประกอบการ',
      last_name: 'ตัวอย่าง',
      email: 'operator@example.test',
      phone: '0800000000',
      regis_date: '2026-08-10T12:01:53',
      juristics: [
        {
          juristic_id: '0100000000001',
          name_th: 'บริษัท ทดสอบ จำกัด',
          name_en: 'TEST COMPANY LIMITED',
          factories: [
            {
              fid: '10100000000001',
              code: 'TEST-001',
              name: 'โรงงานทดสอบ',
              province_id: '1000',
              system_id: 12,
              verify_status: 1,
              authorize_start: '2024-09-02',
              authorize_end: '2024-09-30',
              juristic_start: '2024-08-05',
              verify_date: '2024-09-13',
            },
          ],
        },
      ],
    });
  });

  it('normalizes safe registration dates and maps missing or invalid dates to null', () => {
    const parseWithRegistrationDate = (userRegisDate: unknown) =>
      parseDiwOperatorLoginResponse(
        [
          {
            citizen_id: '4444444444444',
            status: 'true',
            userRegisDate,
            juristic: '[]',
          },
        ],
        '1000',
        '4444444444444',
      );

    expect(parseWithRegistrationDate('2026-08-10T12:01:53')).toMatchObject({
      regis_date: '2026-08-10T12:01:53',
    });
    expect(parseWithRegistrationDate(null)).toMatchObject({ regis_date: null });
    expect(parseWithRegistrationDate('31/02/2026 12:01:53')).toMatchObject({
      regis_date: null,
    });
  });

  it('rejects unsuccessful DIW login responses', () => {
    expect(
      parseDiwOperatorLoginResponse([{ status: 'false' }], '1000', '1111111111111'),
    ).toBeNull();
  });

  it('rejects a submitted operator login that is not exactly 13 digits', () => {
    expect(
      parseDiwOperatorLoginResponse(
        [{ status: 'true', citizen_id: '1111111111111', juristic: '[]' }],
        '1000',
        'operator-user',
      ),
    ).toBeNull();
  });

  it('rejects a DIW citizen identity that does not match the submitted operator login', () => {
    expect(
      parseDiwOperatorLoginResponse(
        [{ status: 'true', citizen_id: '2222222222222', juristic: '[]' }],
        '1000',
        '1111111111111',
      ),
    ).toBeNull();
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

    const result = await provider.authenticateOperator('1234567890123', 'secret-password');

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
          username: '1234567890123',
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

  it('uses the submitted 13-digit login as the provider-scoped i-Industry identity', async () => {
    const submittedLogin = '1111111111111';
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => [
        {
          citizen_id: submittedLogin,
          status: true,
          userCode: 'OP-001',
          userFirstName: 'ผู้ประกอบการ',
          userLastName: 'ทดสอบ',
          juristic: '[]',
        },
      ],
    })) as unknown as typeof fetch;
    const provider = new DiwUserLoginIdentityProvider({
      operatorUrl: 'https://example.test/operator',
      officerUrl: 'https://example.test/officer',
      clientId: 'test-client-id',
      timeoutMs: 1000,
      defaultProvinceId: '1000',
      fetchImpl,
    });

    const result = await provider.authenticateOperator(submittedLogin, 'secret-password');

    expect(result).toMatchObject({
      identity_provider: 'i_industry',
      external_id: submittedLogin,
      citizen_id: submittedLogin,
    });
  });

  it('rejects an operator response whose citizen identity differs from the submitted login', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => [
        {
          citizen_id: '2222222222222',
          status: true,
          userCode: 'OP-002',
          userFirstName: 'ผู้ประกอบการ',
          userLastName: 'ไม่ตรงกัน',
          juristic: '[]',
        },
      ],
    })) as unknown as typeof fetch;
    const provider = new DiwUserLoginIdentityProvider({
      operatorUrl: 'https://example.test/operator',
      officerUrl: 'https://example.test/officer',
      clientId: 'test-client-id',
      timeoutMs: 1000,
      defaultProvinceId: '1000',
      fetchImpl,
    });

    await expect(
      provider.authenticateOperator('1111111111111', 'secret-password'),
    ).resolves.toBeNull();
  });

  it('rejects a non-13-digit submitted operator login instead of assigning i-Industry identity', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => [
        {
          citizen_id: '1111111111111',
          status: true,
          userCode: 'OP-003',
          userFirstName: 'ผู้ประกอบการ',
          userLastName: 'ทดสอบ',
          juristic: '[]',
        },
      ],
    })) as unknown as typeof fetch;
    const provider = new DiwUserLoginIdentityProvider({
      operatorUrl: 'https://example.test/operator',
      officerUrl: 'https://example.test/officer',
      clientId: 'test-client-id',
      timeoutMs: 1000,
      defaultProvinceId: '1000',
      fetchImpl,
    });

    await expect(
      provider.authenticateOperator('operator-user', 'secret-password'),
    ).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
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

    const result = await provider.authenticateOfficer('U100', 'secret-password', '2');

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://diwws.diw.go.th/idiwdpislogin/v1/UserLogin',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          clientId: 'test-client-id',
          username: 'U100',
          password: 'secret-password',
          departmentID: '2',
        }),
      }),
    );
    expect(result).toMatchObject({
      identity_provider: 'diw_dpis',
      external_id: 'U100',
      first_name: 'สมหญิง',
      last_name: 'ทดสอบ',
    });
  });

  it('keeps a 13-digit submitted login as an i-Industry account key', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        status: true,
        msg: JSON.stringify([
          {
            percardno: '9999999999999',
            per_name: 'สมชาย',
            per_surname: 'ทดสอบ',
          },
        ]),
      }),
    })) as unknown as typeof fetch;
    const provider = new DiwUserLoginIdentityProvider({
      operatorUrl: 'https://example.test/operator',
      officerUrl: 'https://example.test/officer',
      clientId: 'test-client-id',
      timeoutMs: 1000,
      defaultProvinceId: '1000',
      fetchImpl,
    });

    const result = await provider.authenticateOfficer('1111111111111', 'secret-password', '8');

    expect(result).toMatchObject({
      identity_provider: 'i_industry',
      external_id: '1111111111111',
    });
  });
});
