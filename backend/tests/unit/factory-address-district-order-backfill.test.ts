import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import { down, up } from '../../src/db/migrations/0085_place_factory_province_after_district';

describe('factory address district-order backfill', () => {
  it('moves a misplaced province after the district in eligible factories', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const knex = createKnex({
      eligibleRows: queryRows([
        {
          id: 327,
          address: 'โฉนดที่ดินเลขที่ จังหวัดร้อยเอ็ด 39274 หมู่ 9 ตำบลสระคู อำเภอสุวรรณภูมิ 45130',
          province_name: 'ร้อยเอ็ด',
        },
      ]),
      monitoringRows: queryRows([]),
      requestRows: queryRows([]),
      connectedRows: queryRows([]),
      trx: { raw },
    });

    await up(knex);

    expect(raw).toHaveBeenCalledTimes(1);
    expect(raw.mock.calls[0]?.[0]).toContain('factory_address_district_order_0085');
    expect(raw.mock.calls[0]?.[1]).toEqual([
      'eligible_factory',
      327,
      'โฉนดที่ดินเลขที่ จังหวัดร้อยเอ็ด 39274 หมู่ 9 ตำบลสระคู อำเภอสุวรรณภูมิ 45130',
      'โฉนดที่ดินเลขที่ 39274 หมู่ 9 ตำบลสระคู อำเภอสุวรรณภูมิ จังหวัดร้อยเอ็ด 45130',
      'eligible_factory',
    ]);
  });

  it('updates monitoring forms, active requests, and connected POMS addresses', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const knex = createKnex({
      eligibleRows: queryRows([]),
      monitoringRows: queryRows([
        {
          id: 21,
          address: 'โฉนดเลขที่ จังหวัดเชียงใหม่ 12345 อำเภอเมืองเชียงใหม่ 50000',
          province_name: 'เชียงใหม่',
        },
      ]),
      requestRows: queryRows([
        {
          id: 31,
          address: 'โฉนดเลขที่ จังหวัดชลบุรี 23456 อำเภอเมืองชลบุรี 20000',
          province_name: 'ชลบุรี',
        },
      ]),
      connectedRows: queryRows([
        {
          id: 41,
          address: 'โฉนดเลขที่ จังหวัดระยอง 34567 อำเภอเมืองระยอง 21000',
          province_name: 'ระยอง',
        },
      ]),
      trx: { raw },
    });

    await up(knex);

    expect(raw.mock.calls.map((call) => call[1])).toEqual([
      [
        'monitoring_point_form',
        21,
        'โฉนดเลขที่ จังหวัดเชียงใหม่ 12345 อำเภอเมืองเชียงใหม่ 50000',
        'โฉนดเลขที่ 12345 อำเภอเมืองเชียงใหม่ จังหวัดเชียงใหม่ 50000',
        'monitoring_point_form',
      ],
      [
        'connection_request',
        31,
        'โฉนดเลขที่ จังหวัดชลบุรี 23456 อำเภอเมืองชลบุรี 20000',
        'โฉนดเลขที่ 23456 อำเภอเมืองชลบุรี จังหวัดชลบุรี 20000',
        'connection_request',
      ],
      [
        'connected_poms',
        41,
        'โฉนดเลขที่ จังหวัดระยอง 34567 อำเภอเมืองระยอง 21000',
        'โฉนดเลขที่ 34567 อำเภอเมืองระยอง จังหวัดระยอง 21000',
        'connected_poms',
      ],
    ]);
  });

  it('restores only addresses that still match the migration output', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const dropTable = jest.fn().mockResolvedValue(undefined as never);
    const trx = { raw };
    const backupRows = [{ entity_type: 'eligible_factory' }];
    const knex = Object.assign(
      jest.fn((tableName: string) => {
        if (tableName === 'factory_address_district_order_0085') {
          return { distinct: jest.fn().mockResolvedValue(backupRows as never) };
        }
        throw new Error(`Unexpected rollback source: ${tableName}`);
      }),
      {
        schema: {
          hasTable: jest.fn().mockResolvedValue(true as never),
          dropTable,
        },
        transaction: jest.fn(async (callback: (transaction: unknown) => Promise<void>) =>
          callback(trx),
        ),
      },
    ) as unknown as Knex;

    await down(knex);

    expect(raw).toHaveBeenCalledWith(expect.stringContaining('UPDATE target'), [
      'eligible_factory',
    ]);
    expect(dropTable).toHaveBeenCalledWith('factory_address_district_order_0085');
  });
});

function queryRows(rows: unknown[]) {
  return {
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    whereNot: jest.fn().mockReturnThis(),
    select: jest.fn().mockResolvedValue(rows as never),
  };
}

function createKnex(args: {
  eligibleRows: ReturnType<typeof queryRows>;
  monitoringRows: ReturnType<typeof queryRows>;
  requestRows: ReturnType<typeof queryRows>;
  connectedRows: ReturnType<typeof queryRows>;
  trx: unknown;
}): Knex {
  const column = { primary: jest.fn().mockReturnThis() };
  const schema = {
    hasTable: jest.fn().mockResolvedValue(false as never),
    createTable: jest.fn((_name: string, callback: (table: Record<string, jest.Mock>) => void) =>
      callback({
        bigIncrements: jest.fn(() => column),
        specificType: jest.fn().mockReturnThis(),
        unique: jest.fn().mockReturnThis(),
      }),
    ),
  };
  return Object.assign(
    jest.fn((tableName: string) => {
      if (tableName === 'eligible_factories') return args.eligibleRows;
      if (tableName === 'factory_monitoring_point_forms') return args.monitoringRows;
      if (tableName === 'cems_wpms_connection_requests as r') return args.requestRows;
      if (tableName === 'cems_wpms_connected_measurement_points as cp') {
        return args.connectedRows;
      }
      throw new Error(`Unexpected source table: ${tableName}`);
    }),
    {
      schema,
      raw: jest.fn((sql: string) => sql),
      transaction: jest.fn(async (callback: (transaction: unknown) => Promise<void>) =>
        callback(args.trx),
      ),
    },
  ) as unknown as Knex;
}
