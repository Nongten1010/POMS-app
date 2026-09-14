import { describe, expect, it, jest } from '@jest/globals';
import knex, { type Knex } from 'knex';
import { up, down, config } from '../../src/db/migrations/0119_add_faq_attachments_and_links';

describe('FAQ attachments migration', () => {
  it('compiles nullable Unicode JSON columns for SQL Server without changing existing FAQ content', async () => {
    const sql: string[] = [];
    const compiler = knex({ client: 'mssql' });
    const db = {
      schema: {
        alterTable: async (name: string, callback: (table: Knex.TableBuilder) => void) => {
          sql.push(
            ...compiler.schema
              .alterTable(name, callback)
              .toSQL()
              .map((item) => item.sql),
          );
        },
      },
      raw: jest.fn(async (statement: string) => {
        sql.push(statement);
      }),
    } as unknown as Knex;
    await up(db);
    expect(config.transaction).toBe(true);
    expect(sql.join('\n')).toContain('[links_json] NVARCHAR(MAX) NULL');
    expect(sql.join('\n')).toContain('[attachments_json] NVARCHAR(MAX) NULL');
    expect(sql.join('\n')).toContain('ISJSON(links_json) = 1');
    expect(sql.join('\n')).toContain('ISJSON(attachments_json) = 1');
    expect(sql.join('\n')).not.toMatch(/DROP|DELETE|TRUNCATE/);
    sql.length = 0;
    await down(db);
    expect(sql[0]).toContain('DROP CONSTRAINT ck_faqs_links_json, ck_faqs_attachments_json');
    expect(sql.join('\n').toLowerCase()).toContain('drop column [links_json], [attachments_json]');
    await compiler.destroy();
  });
});
