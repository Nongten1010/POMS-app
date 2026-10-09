import type { Knex } from 'knex';
import { describe, expect, it, jest } from '@jest/globals';
import { config, down, up } from '../../src/db/migrations/0135_expand_user_prename';

describe('user Thai prename capacity migration', () => {
  it('expands only the nullable prename column without rewriting user data', async () => {
    const raw = jest.fn<(sql: string) => Promise<unknown>>(async () => undefined);

    await up({ schema: { raw } } as unknown as Knex);

    expect(config.transaction).toBe(true);
    expect(raw).toHaveBeenCalledTimes(1);
    expect(raw.mock.calls[0]?.[0].trim()).toBe(
      'ALTER TABLE users ALTER COLUMN prename_th NVARCHAR(64) NULL;',
    );
  });

  it('checks stored bytes before shrinking to preserve trailing spaces and Unicode', async () => {
    const raw = jest.fn<(sql: string) => Promise<unknown>>(async () => undefined);

    await down({ schema: { raw } } as unknown as Knex);

    const guard = raw.mock.calls[0]?.[0];
    expect(guard).toMatch(/SELECT\s+1\s+FROM\s+users\b/i);
    expect(guard).toContain('WITH (TABLOCKX, HOLDLOCK)');
    expect(guard).toContain('DATALENGTH(prename_th) > 32');
    expect(guard).toContain('THROW 50135');
    expect(guard).not.toMatch(/\bLEN\s*\(/i);
    expect(guard).not.toContain('ALTER COLUMN');
    expect(raw).toHaveBeenCalledTimes(2);
    expect(raw.mock.calls[1]?.[0].trim()).toBe(
      'ALTER TABLE users ALTER COLUMN prename_th NVARCHAR(16) NULL;',
    );
  });

  it('never attempts a shrink when a complete prename exceeds the old capacity', async () => {
    const raw = jest.fn<(sql: string) => Promise<unknown>>(async (sql) => {
      if (sql.includes('DATALENGTH')) {
        throw new Error('Cannot shrink users.prename_th while longer values exist.');
      }
    });

    await expect(down({ schema: { raw } } as unknown as Knex)).rejects.toThrow(
      'Cannot shrink users.prename_th while longer values exist.',
    );

    expect(raw).toHaveBeenCalledTimes(1);
  });

  it('stops without other mutations if expanding the column fails', async () => {
    const raw = jest.fn<(sql: string) => Promise<unknown>>(async () => {
      throw new Error('ALTER COLUMN failed');
    });

    await expect(up({ schema: { raw } } as unknown as Knex)).rejects.toThrow('ALTER COLUMN failed');
    expect(raw).toHaveBeenCalledTimes(1);
  });
});
