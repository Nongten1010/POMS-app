import { afterEach, describe, expect, it, jest } from '@jest/globals';
import knex, { type Knex } from 'knex';
import { nextRequestNoForTests } from '../../src/modules/connection-requests/connection-requests.repository';
import { connectionRequestsOpenApiDocument } from '../../src/modules/api-docs/connection-requests.openapi';

const compiler = knex({ client: 'mssql' });
const date = new Date('2026-10-11T00:00:00.000Z');

function transactionFixture(lastSequence: number | string | null) {
  let query: Knex.QueryBuilder;
  const transaction = Object.assign(
    (table: Knex.Raw) => {
      query = compiler(table);
      query.first = jest.fn(async () => ({ last_sequence: lastSequence })) as never;
      return query;
    },
    { raw: compiler.raw.bind(compiler) },
  );
  return {
    transaction: transaction as unknown as Knex.Transaction,
    compiled: () => query.toSQL(),
  };
}

describe('connection request numbering after request removal', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('continues after the highest remaining number when purging requests creates gaps', async () => {
    // There can be only 37 rows left, while CEMS-0038 and CEMS-0053 still exist.
    const fixture = transactionFixture(53);
    await expect(nextRequestNoForTests(fixture.transaction, 'CEMS', date)).resolves.toBe(
      'CEMS-0054/2569',
    );
    const query = fixture.compiled();
    expect(query.sql).toContain('MAX(TRY_CONVERT(BIGINT');
    expect(query.sql).not.toMatch(/count\(/i);
    expect(query.sql).toContain('WITH (UPDLOCK, HOLDLOCK)');
    expect(query.sql).not.toContain('[deleted_at]');
    expect(query.bindings).toContain('CEMS-%/2569');
  });

  it('shares the highest WPMS/WEMS number while writing the current WPMS prefix', async () => {
    const fixture = transactionFixture('10000');
    await expect(nextRequestNoForTests(fixture.transaction, 'WPMS', date)).resolves.toBe(
      'WPMS-10001/2569',
    );
    expect(fixture.compiled().bindings).toEqual(['WPMS-%/2569', 'WEMS-%/2569']);
  });

  it('considers only numeric sequences with at least four digits in the selected year', async () => {
    const fixture = transactionFixture(null);
    await expect(nextRequestNoForTests(fixture.transaction, 'CEMS', date)).resolves.toBe(
      'CEMS-0001/2569',
    );
    const query = fixture.compiled();
    expect(query.sql).toContain("COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^0-9]%'");
    expect(query.sql).toContain('LEN([request_no]) >= 14');
  });

  it('keeps malformed short legacy identifiers safe before SQL filters are evaluated', async () => {
    const fixture = transactionFixture(null);
    await expect(nextRequestNoForTests(fixture.transaction, 'CEMS', date)).resolves.toBe(
      'CEMS-0001/2569',
    );
    // SQL Server may evaluate either substring before the WHERE predicates.
    const safeLength = 'CASE WHEN LEN([request_no]) >= 14 THEN LEN([request_no]) - 10 ELSE 0 END';
    expect(fixture.compiled().sql.split(safeLength)).toHaveLength(3);
  });

  it('uses the Asia/Bangkok Buddhist year at the Gregorian year boundary', async () => {
    const fixture = transactionFixture(null);
    await expect(
      nextRequestNoForTests(fixture.transaction, 'WPMS', new Date('2026-12-31T17:00:00Z')),
    ).resolves.toBe('WPMS-0001/2570');
    expect(fixture.compiled().bindings).toContain('WEMS-%/2570');
  });

  it('refuses sequences that cannot be represented exactly', async () => {
    const fixture = transactionFixture('9007199254740991');
    await expect(nextRequestNoForTests(fixture.transaction, 'CEMS', date)).rejects.toThrow(
      RangeError,
    );
  });

  it('publishes maximum-based numbering and legacy WEMS compatibility in runtime OpenAPI', () => {
    const document = connectionRequestsOpenApiDocument as any;
    for (const schemaName of ['ConnectionRequestTableRow', 'ConnectionRequestResponse']) {
      const schema = document.components.schemas[schemaName];
      const properties =
        schemaName === 'ConnectionRequestResponse'
          ? schema.properties.data.properties
          : schema.properties;
      expect(properties.requestNo.description).toContain('เลขลำดับสูงสุด');
      expect(properties.requestNo.description).toContain('WEMS');
    }
  });
});
