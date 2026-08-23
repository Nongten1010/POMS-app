import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import {
  config,
  down,
  up,
} from '../../src/db/migrations/0099_add_test_mode_to_device_measurement_channels';

describe('device measurement channel test mode migration', () => {
  it('adds a non-null test_mode column with a false default', async () => {
    const hasColumn = jest.fn().mockResolvedValue(false as never);
    const defaultTo = jest.fn();
    const notNullable = jest.fn(() => ({ defaultTo }));
    const boolean = jest.fn((_name: string) => ({ notNullable }));
    const alterTable = jest.fn(
      (
        _: string,
        callback: (table: {
          boolean: (name: string) => { notNullable: () => { defaultTo: (value: boolean) => void } };
        }) => void,
      ) => {
        callback({ boolean });
        return Promise.resolve(undefined);
      },
    );
    const knex = {
      schema: { hasColumn, alterTable },
    } as unknown as Knex;

    await up(knex);

    expect(config).toEqual({ transaction: true });
    expect(hasColumn).toHaveBeenCalledWith('device_measurement_channels', 'test_mode');
    expect(alterTable).toHaveBeenCalledWith('device_measurement_channels', expect.any(Function));
    expect(boolean).toHaveBeenCalledWith('test_mode');
    expect(notNullable).toHaveBeenCalledTimes(1);
    expect(defaultTo).toHaveBeenCalledWith(false);
  });

  it('does not add test_mode again when the column already exists', async () => {
    const hasColumn = jest.fn().mockResolvedValue(true as never);
    const alterTable = jest.fn();
    const knex = {
      schema: { hasColumn, alterTable },
    } as unknown as Knex;

    await up(knex);

    expect(alterTable).not.toHaveBeenCalled();
  });

  it('drops test_mode on rollback when the column exists', async () => {
    const hasColumn = jest.fn().mockResolvedValue(true as never);
    const dropColumn = jest.fn();
    const alterTable = jest.fn(
      (_: string, callback: (table: { dropColumn: (name: string) => void }) => void) => {
        callback({ dropColumn });
        return Promise.resolve(undefined);
      },
    );
    const knex = {
      schema: { hasColumn, alterTable },
    } as unknown as Knex;

    await down(knex);

    expect(hasColumn).toHaveBeenCalledWith('device_measurement_channels', 'test_mode');
    expect(alterTable).toHaveBeenCalledWith('device_measurement_channels', expect.any(Function));
    expect(dropColumn).toHaveBeenCalledWith('test_mode');
  });

  it('does not drop test_mode when the column is already absent', async () => {
    const hasColumn = jest.fn().mockResolvedValue(false as never);
    const alterTable = jest.fn();
    const knex = {
      schema: { hasColumn, alterTable },
    } as unknown as Knex;

    await down(knex);

    expect(alterTable).not.toHaveBeenCalled();
  });
});
