import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import { down, up } from '../../src/db/migrations/0084_backfill_factory_address_provinces';

describe('factory address province backfill', () => {
  it('backs up and adds province to an active eligible-factory address', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const eligibleRows = queryRows([
      {
        id: 17,
        address: '89 หมู่ 1 ตำบลบ้านเลน อำเภอบางปะอิน 13160',
        province_name: 'พระนครศรีอยุธยา',
      },
    ]);
    const emptyRows = queryRows([]);
    const trx = { raw };
    const knex = createKnex({
      eligibleRows,
      monitoringRows: emptyRows,
      requestRows: emptyRows,
      connectedRows: emptyRows,
      trx,
    });

    await up(knex);

    const normalizedAddress = '89 หมู่ 1 ตำบลบ้านเลน อำเภอบางปะอิน จังหวัดพระนครศรีอยุธยา 13160';
    expect(raw).toHaveBeenCalledTimes(1);
    expect(raw.mock.calls[0]?.[0]).toContain('UPDATE target');
    expect(raw.mock.calls[0]?.[0]).toContain('INTO [factory_address_province_backfill_0084]');
    expect(raw.mock.calls[0]?.[1]).toEqual([
      'eligible_factory',
      17,
      '89 หมู่ 1 ตำบลบ้านเลน อำเภอบางปะอิน 13160',
      normalizedAddress,
      'eligible_factory',
    ]);
  });

  it('propagates full addresses through monitoring forms, active requests, and connected POMS', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const trx = { raw };
    const knex = createKnex({
      eligibleRows: queryRows([]),
      monitoringRows: queryRows([
        { id: 21, address: '1 อำเภอเมือง 50000', province_name: 'เชียงใหม่' },
      ]),
      requestRows: queryRows([{ id: 31, address: '2 อำเภอเมือง 20000', province_name: 'ชลบุรี' }]),
      connectedRows: queryRows([{ id: 41, address: '3 อำเภอเมือง 21000', province_name: 'ระยอง' }]),
      trx,
    });

    await up(knex);

    expect(raw.mock.calls.map((call) => call[1])).toEqual([
      [
        'monitoring_point_form',
        21,
        '1 อำเภอเมือง 50000',
        '1 อำเภอเมือง จังหวัดเชียงใหม่ 50000',
        'monitoring_point_form',
      ],
      [
        'connection_request',
        31,
        '2 อำเภอเมือง 20000',
        '2 อำเภอเมือง จังหวัดชลบุรี 20000',
        'connection_request',
      ],
      [
        'connected_poms',
        41,
        '3 อำเภอเมือง 21000',
        '3 อำเภอเมือง จังหวัดระยอง 21000',
        'connected_poms',
      ],
    ]);
  });

  it('restores only the address that still matches the migration output', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const dropTable = jest.fn().mockResolvedValue(undefined as never);
    const trx = { raw };
    const backupRows = [
      {
        entity_type: 'connected_poms',
        entity_id: 41,
        original_address: '3 อำเภอเมือง 21000',
        normalized_address: '3 อำเภอเมือง จังหวัดระยอง 21000',
      },
    ];
    const knex = Object.assign(
      jest.fn((tableName: string) => {
        if (tableName === 'factory_address_province_backfill_0084') {
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

    expect(raw).toHaveBeenCalledWith(expect.stringContaining('UPDATE target'), ['connected_poms']);
    expect(raw.mock.calls[0]?.[0]).toContain('[factory_address] = backup.original_address');
    expect(dropTable).toHaveBeenCalledWith('factory_address_province_backfill_0084');
  });
});

function queryRows(rows: unknown[]) {
  const query = {
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    whereNot: jest.fn().mockReturnThis(),
    select: jest.fn().mockResolvedValue(rows as never),
  };
  return query;
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
