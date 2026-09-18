import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { db } from '../../src/config/database';
import { config, up } from '../../src/db/migrations/0123_add_poms_edit_request_target_ids';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('POMS edit-request target migration', () => {
  it('adds nullable storage without guessing target IDs for historical requests', async () => {
    const statements: string[] = [];
    jest.spyOn(db.client, 'runner').mockImplementation(((query: {
      toSQL(): { sql: string }[];
    }) => ({
      run: async () => {
        statements.push(...query.toSQL().map(({ sql }) => sql));
        return [];
      },
    })) as never);
    await up(db);
    expect(config.transaction).toBe(true);
    expect(statements).toEqual([
      'ALTER TABLE [poms_factory_edit_requests] ADD [target_measurement_point_ids_json] nvarchar(max) null',
    ]);
  });
});
