import type { Knex } from 'knex';
import { describe, expect, it, jest } from '@jest/globals';
import { config, down, up } from '../../src/db/migrations/0131_expand_rejection_history_notes';

describe('rejection history note capacity', () => {
  const tables = ['cems_wpms_request_status_history', 'kwp_form_status_history'];

  it('stores both optional 1000-character notes and their separator atomically', async () => {
    const raw = jest.fn<(sql: string) => Promise<unknown>>(async () => undefined);
    await up({ schema: { raw } } as unknown as Knex);
    const sql = raw.mock.calls.map(([statement]) => statement).join('\n');
    for (const table of tables) {
      expect(sql).toContain(`ALTER TABLE ${table} ALTER COLUMN note NVARCHAR(2001) NULL`);
    }
    expect(config.transaction).toBe(true);
  });

  it('checks both tables before shrinking either column on rollback', async () => {
    const raw = jest.fn<(sql: string) => Promise<unknown>>(async () => undefined);
    await down({ schema: { raw } } as unknown as Knex);
    const guard = raw.mock.calls[0]?.[0];
    for (const table of tables) {
      expect(guard).toContain(`FROM ${table}`);
    }
    expect(guard).toContain('DATALENGTH(note) > 2000');
    expect(guard).toContain('THROW');
    expect(guard).not.toContain('ALTER COLUMN');
    expect(
      raw.mock.calls
        .slice(1)
        .map(([statement]) => statement)
        .join('\n'),
    ).toContain('ALTER COLUMN note NVARCHAR(1000) NULL');
  });

  it('refuses rollback without losing an existing long audit note', async () => {
    const raw = jest.fn<(sql: string) => Promise<unknown>>(async (sql) => {
      if (sql.includes('DATALENGTH')) throw new Error('Long audit notes exist');
    });
    await expect(down({ schema: { raw } } as unknown as Knex)).rejects.toThrow(
      'Long audit notes exist',
    );
    expect(raw).toHaveBeenCalledTimes(1);
  });
});
