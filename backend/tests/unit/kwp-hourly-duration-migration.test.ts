import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import { down, up } from '../../src/db/migrations/0079_add_kwp_hourly_duration_fields';

describe('KWP hourly duration migration', () => {
  it('adds nullable civil-time and total-hour columns to KWP01 and KWP03', async () => {
    const operations: string[][] = [];
    const alterTable = jest.fn(
      (
        tableName: string,
        callback: (table: {
          specificType: (column: string, type: string) => void;
          integer: (column: string) => { nullable: () => void };
        }) => void,
      ) => {
        callback({
          specificType: (column, type) => operations.push([tableName, column, type]),
          integer: (column) => ({
            nullable: () => {
              operations.push([tableName, column, 'INTEGER NULL']);
            },
          }),
        });
      },
    );
    const knex = { schema: { alterTable } } as unknown as Knex;

    await up(knex);

    expect(operations).toEqual([
      ['kwp01_issue_reports', 'problem_datetime', 'DATETIME2(0) NULL'],
      ['kwp01_issue_reports', 'expected_done_datetime', 'DATETIME2(0) NULL'],
      ['kwp01_issue_reports', 'total_hours', 'INTEGER NULL'],
      ['kwp03_wpms_issue_reports', 'problem_datetime', 'DATETIME2(0) NULL'],
      ['kwp03_wpms_issue_reports', 'expected_done_datetime', 'DATETIME2(0) NULL'],
      ['kwp03_wpms_issue_reports', 'total_hours', 'INTEGER NULL'],
    ]);
  });

  it('removes the new columns in reverse table order', async () => {
    const operations: string[][] = [];
    const alterTable = jest.fn(
      (tableName: string, callback: (table: { dropColumn: (column: string) => void }) => void) => {
        callback({
          dropColumn: (column) => operations.push([tableName, column]),
        });
      },
    );
    const knex = { schema: { alterTable } } as unknown as Knex;

    await down(knex);

    expect(operations).toEqual([
      ['kwp03_wpms_issue_reports', 'total_hours'],
      ['kwp03_wpms_issue_reports', 'expected_done_datetime'],
      ['kwp03_wpms_issue_reports', 'problem_datetime'],
      ['kwp01_issue_reports', 'total_hours'],
      ['kwp01_issue_reports', 'expected_done_datetime'],
      ['kwp01_issue_reports', 'problem_datetime'],
    ]);
  });
});
