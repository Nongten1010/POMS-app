import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { db } from '../../src/config/database';
import { env } from '../../src/config/env';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';

type Query = { toSQL(): { sql: string; bindings: unknown[] } };
const previousMode = env.FACTORY_PROFILE_MODE;
const currentRow = {
  id: 7,
  fid: 'FID-17',
  code: 'REG-17',
  name: 'ชื่ออนุมัติล่าสุด',
  eligible_factory_id: 17,
  province_name: 'นนทบุรี',
  address: 'ที่อยู่ปัจจุบัน',
  latitude: 14,
  longitude: 101,
  factory_type_sequence: '00088',
  has_eia: false,
  eia_assessment: 'อื่นๆ',
  eia_other: 'รายงานเฉพาะ',
  project_name: null,
  juristic_id: 'JURISTIC-17',
  juristic_name: 'นิติบุคคลเดิม',
  system_id: 7,
  authorize_start: null,
  authorize_end: null,
};

describe('factory general canonical prefill', () => {
  let queries: Array<{ sql: string; bindings: unknown[] }>;
  beforeEach(() => {
    env.FACTORY_PROFILE_MODE = 'canonical';
    queries = [];
    jest.spyOn(db.client, 'runner').mockImplementation(((query: Query) => ({
      run: async () => {
        queries.push(query.toSQL());
        return currentRow;
      },
    })) as never);
  });
  afterEach(() => {
    env.FACTORY_PROFILE_MODE = previousMode;
    jest.restoreAllMocks();
  });

  it('reads current name and scope locations from the canonical eligible profile while preserving master identity', async () => {
    const result = await connectionRequestsRepository.findFactoryGeneral('FID-17', {
      actorUserId: 7,
      scope: { scope: 'IN_PROVINCE', province: 'นนทบุรี', region: null },
    });
    expect(queries[0].sql.toLowerCase()).toContain('current_eligible_factories');
    expect(queries[0].sql.toLowerCase()).toContain('ef.factory_name');
    expect(queries[0].sql.toLowerCase()).toContain('ef.province_name');
    expect(queries[0].bindings).toContain('นนทบุรี');
    expect(queries[0].sql.toLowerCase()).toContain('then ef.province_name');
    expect(queries[0].sql.toLowerCase()).toContain('then ef.industrial_estate_name');
    expect(result).toMatchObject({
      factoryId: 'FID-17',
      newRegistrationNo: 'REG-17',
      juristicId: 'JURISTIC-17',
    });
  });

  it('returns the current EIA assessment and cleared project instead of synthetic master defaults', async () => {
    const result = await connectionRequestsRepository.findFactoryGeneral('FID-17', {
      actorUserId: 7,
      scope: 'ALL',
    });
    expect(result).toMatchObject({ eia: 'อื่นๆ', eiaOther: 'รายงานเฉพาะ', projectName: null });
  });

  it.each(['legacy', 'canonical'] as const)(
    'keeps EIA detail in accessible factory summaries in %s mode',
    async (mode) => {
      env.FACTORY_PROFILE_MODE = mode;
      jest.spyOn(db.client, 'runner').mockImplementation(((query: Query) => ({
        run: async () => {
          queries.push(query.toSQL());
          return [currentRow];
        },
      })) as never);
      const result = await connectionRequestsRepository.listFactoriesForAccess({
        actorUserId: 7,
        scope: 'OWN_FACTORY',
      });
      expect(result[0]).toMatchObject({ eia: 'อื่นๆ', eiaOther: 'รายงานเฉพาะ' });
    },
  );
});
