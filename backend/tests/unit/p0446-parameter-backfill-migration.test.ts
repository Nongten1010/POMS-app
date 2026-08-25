import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import {
  config,
  up,
} from '../../src/db/migrations/0101_backfill_p0446_measurement_point_parameters';

describe('P0446 measurement-point parameter backfill', () => {
  it('repairs only empty active request and connected snapshots for WPMS-0011/2569', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const knex = { schema: { raw } } as unknown as Knex;

    await up(knex);

    expect(config).toEqual({ transaction: true });
    const sql = raw.mock.calls.map(([statement]) => String(statement)).join('\n');
    expect(sql).toContain('UPDATE request_point');
    expect(sql).toContain('UPDATE connected_point');
    expect(sql).toContain("request_row.request_no = 'WPMS-0011/2569'");
    expect(sql).toContain("UPPER(LTRIM(RTRIM(request_point.point_code))) = 'P0446'");
    expect(sql).toContain("UPPER(LTRIM(RTRIM(connected_point.point_code))) = 'P0446'");
    expect(sql).toContain("LTRIM(RTRIM(request_point.parameters_json)) = N'[]'");
    expect(sql).toContain("LTRIM(RTRIM(connected_point.parameters_json)) = N'[]'");
    expect(sql).toContain('N\'["BOD (mg/l)","Flow rate (m3/hr)","Watt (kW/hr)"]\'');
  });
});
