import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import {
  down,
  up,
} from '../../src/db/migrations/0077_add_project_fields_to_monitoring_point_forms';

describe('monitoring point form project fields migration', () => {
  it('adds nullable project and EIA-detail columns and can remove them', async () => {
    const specificType = jest.fn();
    const dropColumn = jest.fn();
    const alterTable = jest.fn(
      (
        tableName: string,
        callback: (table: {
          specificType: typeof specificType;
          dropColumn: typeof dropColumn;
        }) => void,
      ) => {
        expect(tableName).toBe('factory_monitoring_point_forms');
        callback({ specificType, dropColumn });
      },
    );
    const knex = { schema: { alterTable } } as unknown as Knex;

    await up(knex);
    await down(knex);

    expect(specificType.mock.calls).toEqual([
      ['eia_other', 'NVARCHAR(500) NULL'],
      ['project_name', 'NVARCHAR(500) NULL'],
    ]);
    expect(dropColumn.mock.calls).toEqual([['project_name'], ['eia_other']]);
  });
});
