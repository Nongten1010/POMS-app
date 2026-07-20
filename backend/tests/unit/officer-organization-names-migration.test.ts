import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import { down, up } from '../../src/db/migrations/0071_add_officer_organization_names';

describe('officer organization names migration', () => {
  it('adds separate Unicode display-name columns without widening ID columns', async () => {
    const specificType = jest.fn();
    const alterTable = jest.fn(
      (_tableName: string, callback: (table: { specificType: typeof specificType }) => void) =>
        callback({ specificType }),
    );
    const knex = { schema: { alterTable } } as unknown as Knex;

    await up(knex);

    expect(alterTable).toHaveBeenCalledWith('officer_profiles', expect.any(Function));
    expect(specificType.mock.calls).toEqual([
      ['organize_name_th', 'NVARCHAR(255) NULL'],
      ['division_name_th', 'NVARCHAR(255) NULL'],
    ]);
  });

  it('removes only the V2 organization display-name columns on rollback', async () => {
    const dropColumn = jest.fn();
    const alterTable = jest.fn(
      (_tableName: string, callback: (table: { dropColumn: typeof dropColumn }) => void) =>
        callback({ dropColumn }),
    );
    const knex = { schema: { alterTable } } as unknown as Knex;

    await down(knex);

    expect(dropColumn.mock.calls).toEqual([['division_name_th'], ['organize_name_th']]);
  });
});
