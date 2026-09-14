import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import { config, down, up } from '../../src/db/migrations/0120_expand_law_document_types';

describe('law document types migration', () => {
  it('expands the checked values without rewriting historical rows', async () => {
    const raw = jest.fn(async (_sql: string) => undefined);
    await up({ raw } as unknown as Knex);
    const sql = raw.mock.calls.map(([statement]) => statement).join('\n');

    expect(config.transaction).toBe(true);
    expect(sql).toContain('ALTER TABLE laws DROP CONSTRAINT ck_laws_document_type');
    expect(sql).toContain('WITH CHECK ADD CONSTRAINT ck_laws_document_type');
    expect(constraintValues(sql)).toEqual([
      'MINISTERIAL_REGULATION',
      'MINISTRY_ANNOUNCEMENT',
      'DEPARTMENT_ANNOUNCEMENT',
      'REGULATION_REQUIREMENT',
      'OTHER',
      'RULE_AND_ANNOUNCEMENT',
    ]);
    expect(sql).not.toMatch(/\b(UPDATE|DELETE|INSERT|TRUNCATE)\b/i);
  });

  it('guards rollback against new types including soft-deleted rows before changing the constraint', async () => {
    const raw = jest.fn(async (_sql: string) => undefined);
    await down({ raw } as unknown as Knex);
    const sql = raw.mock.calls.map(([statement]) => statement).join('\n');

    expect(sql).toMatch(
      /IF EXISTS\s*\(\s*SELECT 1 FROM laws\s*WHERE document_type IN \('MINISTRY_ANNOUNCEMENT', 'DEPARTMENT_ANNOUNCEMENT'\)\s*\)\s*BEGIN\s*THROW 51200/,
    );
    expect(sql.indexOf('THROW 51200')).toBeLessThan(sql.indexOf('DROP CONSTRAINT'));
    expect(sql).not.toContain('deleted_at');
    expect(sql).toContain('WITH CHECK ADD CONSTRAINT ck_laws_document_type');
    expect(constraintValues(sql)).toEqual([
      'MINISTERIAL_REGULATION',
      'RULE_AND_ANNOUNCEMENT',
      'REGULATION_REQUIREMENT',
      'OTHER',
    ]);
    expect(sql).not.toMatch(/\b(UPDATE|DELETE|INSERT|TRUNCATE)\b/i);
  });
});

function constraintValues(sql: string): string[] {
  const values = sql.match(/CHECK \(document_type IN \(([\s\S]*?)\)\)/)?.[1];
  if (!values) throw new Error('Missing document type constraint');
  return [...values.matchAll(/'([^']+)'/g)].map((match) => match[1]);
}
