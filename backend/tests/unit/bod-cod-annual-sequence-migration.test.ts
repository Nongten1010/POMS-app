import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import { up, down } from '../../src/db/migrations/0124_add_bod_cod_annual_report_sequence';

describe('BOD/COD annual sequence migration', () => {
  it('adds a nullable sequence and point/parameter/year index without rewriting old reports', async () => {
    const nullable = jest.fn();
    const integer = jest.fn((_name: string) => ({ nullable }));
    const raw = jest.fn(async (_sql: string) => undefined);
    const alterTable = jest.fn(async (_table: string, callback: (table: unknown) => void) =>
      callback({ integer }),
    );
    await up({ schema: { alterTable }, raw } as unknown as Knex);
    expect(integer).toHaveBeenCalledWith('report_sequence_no');
    expect(nullable).toHaveBeenCalled();
    const sql = raw.mock.calls.map(([value]) => value).join('\n');
    expect(sql).toContain('connected_measurement_point_id, selected_parameter_code, report_year');
    expect(sql).toContain('report_sequence_no > 0');
    expect(sql).not.toMatch(/\b(?:UPDATE|INSERT|DELETE)\b/i);
  });

  it('removes the constraint and index before dropping the column on development rollback', async () => {
    const calls: string[] = [];
    const raw = async (sql: string) => {
      calls.push(sql);
    };
    const dropColumn = (name: string) => {
      calls.push(name);
    };
    const alterTable = async (_table: string, callback: (table: unknown) => void) =>
      callback({ dropColumn });
    await down({ raw, schema: { alterTable } } as unknown as Knex);
    expect(calls[0]).toContain('DROP CONSTRAINT ck_bodcod_annual_sequence');
    expect(calls[1]).toBe('report_sequence_no');
  });
});
