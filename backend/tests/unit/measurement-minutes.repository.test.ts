import { afterEach, beforeEach, expect, it } from '@jest/globals';
import { env } from '../../src/config/env';
import { parameterSourceDb } from '../../src/config/parameter-source-database';
import { parameterValuesRepository } from '../../src/modules/parameter-values/parameter-values.repository';
import { createKnexSqliteFixture, type KnexSqliteFixture } from '../helpers/knex-sqlite-fixture';

let source: KnexSqliteFixture;
const originalSchema = env.PARAMETER_DB_SCHEMA;
beforeEach(async () => {
  env.PARAMETER_DB_SCHEMA = 'ingest';
  source = await createKnexSqliteFixture(parameterSourceDb, {});
  source.execute("ATTACH DATABASE ':memory:' AS ingest");
  source.execute('CREATE TABLE ingest.S0199_data_1m (cdate TEXT, ctime TEXT, co_value REAL)');
});
afterEach(() => {
  source?.close();
  env.PARAMETER_DB_SCHEMA = originalSchema;
});

it.each(['00', '09', '23'])(
  'reads only hour %s using measurement time, including its last fractional second',
  async (hour) => {
    source.execute(
      'INSERT INTO ingest.S0199_data_1m VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?), (?, ?, ?)',
      [
        '2026-11-11',
        `${hour}:00:00`,
        10,
        '2026-11-11',
        `${hour}:59:59.9999999`,
        20,
        '2026-11-12',
        `${hour}:00:00`,
        30,
        '2026-11-11',
        hour === '23' ? '22:59:59' : `${String(Number(hour) + 1).padStart(2, '0')}:00:00`,
        40,
      ],
    );
    const rows = await parameterValuesRepository.listMinuteRows({
      stationId: 'S0199',
      date: '2026-11-11',
      hour,
    });
    expect(rows.map((row) => row.co_value)).toEqual([10, 20]);
  },
);
