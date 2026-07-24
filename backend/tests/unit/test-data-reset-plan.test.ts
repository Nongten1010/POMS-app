import { describe, expect, it } from '@jest/globals';
import {
  buildDeletePlan,
  findParameterTables,
  quoteSqlIdentifier,
  validateProductionDatabaseTargets,
  type ForeignKeyEdge,
} from '../../src/db/maintenance/test-data-reset-plan';

describe('production test-data reset plan', () => {
  const edges: ForeignKeyEdge[] = [
    { parentTable: 'requests', childTable: 'points' },
    { parentTable: 'points', childTable: 'connected_points' },
    { parentTable: 'connected_points', childTable: 'kwp_submissions' },
    { parentTable: 'kwp_submissions', childTable: 'kwp_attachments' },
    { parentTable: 'device_configs', childTable: 'device_channels' },
  ];

  it('orders every foreign-key child before its parent', () => {
    expect(buildDeletePlan(['requests', 'device_configs'], edges)).toEqual([
      'kwp_attachments',
      'kwp_submissions',
      'connected_points',
      'points',
      'requests',
      'device_channels',
      'device_configs',
    ]);
  });

  it('rejects a foreign-key cycle instead of producing an unsafe plan', () => {
    const cyclicEdges: ForeignKeyEdge[] = [
      { parentTable: 'requests', childTable: 'points' },
      { parentTable: 'points', childTable: 'requests' },
    ];

    expect(() => buildDeletePlan(['requests'], cyclicEdges)).toThrow('Foreign-key cycle detected');
  });

  it('selects only exact parameter tables owned by the captured stations', () => {
    expect(
      findParameterTables(
        ['CEMS-0001/2569', 'S0001'],
        [
          'CEMS-0001/2569_data_real',
          'CEMS-0001/2569_data_60m',
          'S0001_data_test',
          'S00010_data_real',
          'other_table',
        ],
      ),
    ).toEqual(['CEMS-0001/2569_data_60m', 'CEMS-0001/2569_data_real', 'S0001_data_test']);
  });

  it('quotes safe SQL identifiers and rejects injected identifiers', () => {
    expect(quoteSqlIdentifier('device_connection_configs')).toBe('[device_connection_configs]');
    expect(() => quoteSqlIdentifier('requests]; DROP TABLE users;--')).toThrow(
      'Unsafe SQL identifier',
    );
  });

  it('allows a co-located parameter database but never a local primary database', () => {
    expect(() =>
      validateProductionDatabaseTargets({
        databaseName: 'POMS',
        databaseHost: '172.16.31.184',
        parameterDatabaseName: 'parameter_ingest',
        parameterDatabaseHost: 'localhost',
      }),
    ).not.toThrow();

    expect(() =>
      validateProductionDatabaseTargets({
        databaseName: 'POMS',
        databaseHost: 'localhost',
        parameterDatabaseName: 'parameter_ingest',
        parameterDatabaseHost: 'localhost',
      }),
    ).toThrow('primary database on localhost');
  });
});
