import {
  IdentityProvider,
  ExternalOfficerProfile,
  ExternalOperatorProfile,
  ExternalCitizenProfile,
} from './identity-provider.interface';
import { MOCK_OFFICERS, MOCK_OPERATORS, MOCK_CITIZENS } from '../fixtures/mock-users';

/**
 * Mock identity provider — อ่านจาก fixtures ใน memory
 * ใช้ตอน demo phase ที่ยังไม่มี API จริงของ กรอ.
 */
export class MockIdentityProvider implements IdentityProvider {
  async authenticateOfficer(
    username: string,
    password: string,
  ): Promise<ExternalOfficerProfile | null> {
    const officer = MOCK_OFFICERS.find((o) => o.username === username);
    if (!officer || officer.password !== password) return null;
    return {
      external_id: officer.external_id,
      prename_th: officer.prename_th,
      first_name: officer.first_name,
      last_name: officer.last_name,
      email: officer.email,
      phone: officer.phone,
      ...officer.profile,
    };
  }

  async authenticateOperator(
    citizenId: string,
    password: string,
  ): Promise<ExternalOperatorProfile | null> {
    const op = MOCK_OPERATORS.find((o) => o.citizen_id === citizenId);
    if (!op || op.password !== password) return null;
    return {
      citizen_id: op.citizen_id,
      user_code: op.user_code,
      first_name: op.first_name,
      last_name: op.last_name,
      email: op.email,
      phone: op.phone,
      regis_date: op.regis_date,
      juristics: op.juristics,
    };
  }

  async authenticateCitizen(
    username: string,
    password: string,
  ): Promise<ExternalCitizenProfile | null> {
    const c = MOCK_CITIZENS.find((c) => c.username === username);
    if (!c || c.password !== password) return null;
    return {
      external_id: c.external_id,
      username: c.username,
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
    };
  }
}
