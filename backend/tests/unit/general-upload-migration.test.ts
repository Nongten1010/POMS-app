import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import { up, down } from '../../src/db/migrations/0137_allow_general_attachment_file_types';

describe('general upload migration', () => {
  it('widens monitoring point MIME storage without changing size limits or file paths', async () => {
    const raw = jest.fn<Knex['raw']>();
    await up({ schema: { raw } } as unknown as Knex);
    const sql = String(raw.mock.calls[0][0]);
    expect(sql).toContain('ALTER COLUMN mime_type VARCHAR(128) NOT NULL');
    expect(sql).toContain('DROP CONSTRAINT ck_fmp_attachments_mime_type');
    expect(sql).toContain('DROP CONSTRAINT ck_laws_mime_type');
    expect(sql).not.toContain('file_size');
    expect(sql).not.toContain('storage_path');
  });

  it('guards rollback before altering constraints and never deletes accepted records', async () => {
    const raw = jest.fn<Knex['raw']>();
    await down({ schema: { raw } } as unknown as Knex);
    const sql = String(raw.mock.calls[0][0]);
    expect(sql.indexOf('THROW 50000')).toBeLessThan(sql.indexOf('DROP CONSTRAINT'));
    expect(sql).toContain("mime_type NOT IN ('image/jpeg', 'image/png', 'application/pdf')");
    expect(sql).not.toMatch(/DELETE|UPDATE\s+(?:laws|factory_monitoring)/i);
  });
});
