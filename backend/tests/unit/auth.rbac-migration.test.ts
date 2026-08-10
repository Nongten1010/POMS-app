import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import {
  ensureEstateCodeSchema,
  mapGrantRows,
} from '../../src/db/migrations/0089_expand_auth_rbac_permission_scopes';

describe('auth RBAC migration helpers', () => {
  it('maps only grants whose role and permission still exist in the target catalog', () => {
    expect(
      mapGrantRows(
        [
          { role: 'admin', permission: 'dashboard:view', scope: 'ALL' },
          { role: 'missing_role', permission: 'dashboard:view', scope: 'ALL' },
          { role: 'admin', permission: 'missing_permission', scope: 'ALL' },
        ],
        new Map([['admin', 11]]),
        new Map([['dashboard:view', 22]]),
      ),
    ).toEqual([{ role_id: 11, permission_id: 22, scope: 'ALL' }]);
  });

  it('creates an unfiltered unique estate-code index before adding foreign keys', async () => {
    const rawStatements: string[] = [];
    const knex = {
      schema: {
        hasColumn: jest.fn(async () => true),
        alterTable: jest.fn(),
        raw: jest.fn(async (statement: string) => {
          rawStatements.push(statement);
        }),
      },
    } as unknown as Knex;

    await ensureEstateCodeSchema(knex);

    const uniqueIndexPosition = rawStatements.findIndex((statement) =>
      statement.includes('CREATE UNIQUE INDEX ux_industrial_estates_code_for_fk'),
    );
    const firstForeignKeyPosition = rawStatements.findIndex((statement) =>
      statement.includes('ADD CONSTRAINT fk_user_permissions_estate_code'),
    );

    expect(uniqueIndexPosition).toBeGreaterThanOrEqual(0);
    expect(firstForeignKeyPosition).toBeGreaterThan(uniqueIndexPosition);
    expect(rawStatements[uniqueIndexPosition].split('CREATE UNIQUE INDEX')[1]).not.toContain(
      'WHERE',
    );
  });
});
