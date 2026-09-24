import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import { db } from '../../src/config/database';
import {
  connectionRequestsRepository,
  buildConnectedFactoriesForAccessQueryForTests,
  buildFactoriesForAccessQueryForTests,
} from '../../src/modules/connection-requests/connection-requests.repository';
import { env } from '../../src/config/env';
import { connectionRequestsService } from '../../src/modules/connection-requests/connection-requests.service';
import type { FactorySummaryDTO } from '../../src/modules/connection-requests/connection-requests.types';
import { parameterValuesService } from '../../src/modules/parameter-values/parameter-values.service';

let pointRows: Record<string, unknown>[];
const factory: FactorySummaryDTO = {
  id: 1,
  eligibleFactoryId: 17,
  factoryId: 'factory-1',
  factoryName: 'โรงงานทดสอบ',
  newRegistrationNo: 'REG-1',
  oldRegistrationNo: null,
  industryType: null,
  industryMainOrder: null,
  industrySubOrder: null,
  businessActivity: null,
  eia: null,
  projectName: null,
  address: null,
  latitude: null,
  longitude: null,
  province: null,
  isEligible: true,
  isActive: true,
};

function point(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    eligible_factory_id: 17,
    factory_id: 'factory-1',
    source_measurement_point_id: 1,
    source_request_id: 1,
    point_name: 'จุด A',
    point_code: 'S0001',
    system_type: 'CEMS',
    parameters_json: JSON.stringify(['CO (ppm)', 'NOx (ppm)']),
    instruments_json: JSON.stringify({
      parameters: [
        {
          parameter: 'CO (ppm)',
          standardCriteria: {
            enabled: true,
            standardValue: 100,
            rows: [
              { level: 'normal', min: 0, max: 100 },
              { level: 'warning', min: 100, max: 150 },
              { level: 'critical', min: 150, max: null },
            ],
          },
        },
        {
          parameter: 'NOx (ppm)',
          standardCriteria: { enabled: true, standardValue: 200, rows: [] },
        },
      ],
    }),
    management_state_json: null,
    monitoring_point_status: null,
    ...overrides,
  };
}

beforeEach(() => {
  pointRows = [point()];
  connectionRequestsService.setClockForTests(() => new Date('2026-09-23T03:30:00Z'));
  jest.spyOn(connectionRequestsRepository, 'listFactoriesForAccess').mockResolvedValue([factory]);
  jest
    .spyOn(connectionRequestsRepository, 'listFactoryMainTypeLabels')
    .mockResolvedValue(new Map());
  jest.spyOn(connectionRequestsRepository, 'listFavoriteFactoryIds').mockResolvedValue([]);
  jest.spyOn(connectionRequestsRepository, 'listRequestsForFactories').mockResolvedValue([]);
  jest.spyOn(parameterValuesService, 'latestHourly').mockImplementation(async (stationId) => ({
    data: [
      {
        station_id: stationId,
        cdate: '2026-09-23',
        ctime: '09:00:00',
        co_value: 999,
        co_units: 'ppm',
        co_status: 'Normal',
        nox_value: 10,
        nox_units: 'ppm',
        nox_status: 'Normal',
      },
    ],
    meta: {
      stationId,
      interval: '60m',
      schemaName: 'ingest',
      tableName: `${stationId}_data_60m`,
      count: 1,
      registeredParameters: ['CO (ppm)', 'NOx (ppm)'],
      returnedColumns: [],
    },
  }));
  jest.spyOn(db.client, 'runner').mockImplementation((value: unknown) => ({
    run: async () => {
      const query = (value as Knex.QueryBuilder).toSQL();
      if (query.sql.includes('cems_wpms_connected_measurement_points'))
        return query.method === 'first' ? pointRows[0] : pointRows;
      throw new Error(`Unexpected query: ${query.sql}`);
    },
  }));
});

afterEach(() => {
  connectionRequestsService.setClockForTests(() => new Date());
  jest.restoreAllMocks();
});

describe('home dashboard visibility projection', () => {
  it.each(['dashboard', 'map'] as const)(
    'does not allow visible children to override a hidden factory in %s',
    async (surface) => {
      pointRows = [
        point({
          management_state_json: JSON.stringify({
            factory: { visibility: 'HIDDEN', connectionStatus: 'CONNECTED' },
            measurementPoints: {
              '11': {
                visibility: 'VISIBLE',
                connectionStatus: 'CONNECTED',
                parameters: { 'CO (ppm)': 'VISIBLE', 'NOx (ppm)': 'VISIBLE' },
              },
            },
          }),
        }),
      ];
      const result =
        surface === 'dashboard'
          ? await connectionRequestsService.listOperatorFactoryDashboard(42, 'ALL')
          : await connectionRequestsService.listPublicFactoryMapPoints();
      expect(result.data).toEqual([]);
      expect(parameterValuesService.latestHourly).not.toHaveBeenCalled();
    },
  );

  it.each(['CEMS', 'WPMS'] as const)(
    'filters exempt and hidden %s points before counts and hourly availability',
    async (systemType) => {
      pointRows = [
        point({ system_type: systemType }),
        point({
          id: 12,
          point_code: 'S0002',
          system_type: systemType,
          monitoring_point_status: 'ได้รับการยกเว้นทั้งหมด',
        }),
        point({ id: 13, point_code: 'S0003', system_type: systemType }),
      ];
      const state = JSON.stringify({
        factory: { visibility: 'VISIBLE', connectionStatus: 'CONNECTED' },
        measurementPoints: {
          '13': {
            visibility: 'HIDDEN',
            connectionStatus: 'CONNECTED',
            parameters: { 'CO (ppm)': 'VISIBLE' },
          },
        },
      });
      pointRows.forEach((row) => {
        row.management_state_json = state;
      });
      const result = await connectionRequestsService.listOperatorFactoryDashboard(42, 'ALL');
      expect(result.data[0].measurementPoints.map((p) => p.stationId)).toEqual(['S0001']);
      expect(
        result.data[0].monitoringPointCountBySystem.find((p) => p.systemType === systemType)?.count,
      ).toBe(1);
      expect(result.data[0].hasLatestHourlyMeasurement).toBe(true);
      expect(parameterValuesService.latestHourly).toHaveBeenCalledTimes(1);
    },
  );

  it('omits hidden parameter values and standards without restoring raw-column fallback labels', async () => {
    pointRows = [
      point({
        management_state_json: JSON.stringify({
          factory: { visibility: 'VISIBLE', connectionStatus: 'CONNECTED' },
          measurementPoints: {
            '11': {
              visibility: 'VISIBLE',
              connectionStatus: 'CONNECTED',
              parameters: { 'CO (ppm)': 'HIDDEN', 'NOx (ppm)': 'VISIBLE' },
            },
          },
        }),
      }),
    ];
    const result = await connectionRequestsService.listPublicFactoryMapPoints();
    const measurementPoint = result.data[0].measurementPoints[0];
    expect(measurementPoint.parameters).toEqual(['NOx (ppm)']);
    expect(measurementPoint.parameterStandards.map((p) => p.parameter)).toEqual(['NOx (ppm)']);
    expect(measurementPoint.data[0]).toMatchObject({ 'NOx (ppm)': 10 });
    expect(measurementPoint.data[0]).not.toHaveProperty('CO (ppm)');
  });

  it('preserves the connection overview list even when home hides a point', async () => {
    pointRows = [
      point({
        monitoring_point_status: 'ได้รับการยกเว้นทั้งหมด',
        management_state_json: JSON.stringify({
          factory: { visibility: 'HIDDEN', connectionStatus: 'CONNECTED' },
        }),
      }),
    ];
    const result = await connectionRequestsService.listOperatorFactoryOverview(42);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].measurementPoints).toHaveLength(1);
    expect(result.data[0].measurementPoints[0].parameters).toEqual(['CO (ppm)', 'NOx (ppm)']);
  });

  it('uses the same parent-first visibility for direct home station requests', async () => {
    pointRows = [
      point({
        management_state_json: JSON.stringify({
          factory: { visibility: 'HIDDEN', connectionStatus: 'CONNECTED' },
          measurementPoints: {
            '11': { visibility: 'VISIBLE', parameters: { 'CO (ppm)': 'VISIBLE' } },
          },
        }),
      }),
    ];
    expect(
      await connectionRequestsRepository.getHomeMeasurementPointVisibility('S0001'),
    ).toMatchObject({
      factoryVisible: false,
      pointVisible: false,
      parameters: [],
      fullyExempt: false,
    });
  });

  it('respects an inactive factory in direct home station requests', async () => {
    pointRows = [point({ factory_is_active: 0 })];
    expect(
      await connectionRequestsRepository.getHomeMeasurementPointVisibility('S0001'),
    ).toMatchObject({
      factoryVisible: false,
      pointVisible: false,
      parameters: [],
    });
  });

  it('removes a point when every registered parameter is hidden', async () => {
    pointRows = [
      point({
        management_state_json: JSON.stringify({
          factory: { visibility: 'VISIBLE', connectionStatus: 'CONNECTED' },
          measurementPoints: {
            '11': {
              visibility: 'VISIBLE',
              connectionStatus: 'CONNECTED',
              parameters: { 'CO (ppm)': 'HIDDEN', 'NOx (ppm)': 'HIDDEN' },
            },
          },
        }),
      }),
    ];
    const result = await connectionRequestsService.listOperatorFactoryDashboard(42, 'ALL');
    expect(result.data).toEqual([]);
    expect(parameterValuesService.latestHourly).not.toHaveBeenCalled();
  });

  it.each(['dashboard', 'map'] as const)(
    'removes factories with no remaining points on %s',
    async (surface) => {
      pointRows = [point({ monitoring_point_status: 'ได้รับการยกเว้นทั้งหมด' })];
      const result =
        surface === 'dashboard'
          ? await connectionRequestsService.listOperatorFactoryDashboard(42, 'ALL')
          : await connectionRequestsService.listPublicFactoryMapPoints();
      expect(result).toEqual({ data: [], meta: { total: 0 } });
      expect(parameterValuesService.latestHourly).not.toHaveBeenCalled();
    },
  );

  it('does not relabel a hidden unit as the remaining visible unit of the same parameter', async () => {
    pointRows = [
      point({
        parameters_json: JSON.stringify(['CO2 (%)', 'CO2 (ppm)']),
        instruments_json: null,
        management_state_json: JSON.stringify({
          factory: { visibility: 'VISIBLE' },
          measurementPoints: {
            '11': { visibility: 'VISIBLE', parameters: { 'CO2 (%)': 'HIDDEN' } },
          },
        }),
      }),
    ];
    jest.mocked(parameterValuesService.latestHourly).mockResolvedValue({
      data: [
        {
          station_id: 'S0001',
          cdate: '2026-09-23',
          ctime: '09:00:00',
          co2_value: 5,
          co2_units: '%',
        },
      ],
      meta: {
        stationId: 'S0001',
        interval: '60m',
        schemaName: 'ingest',
        tableName: 'S0001_data_60m',
        count: 1,
        registeredParameters: ['CO2 (%)', 'CO2 (ppm)'],
        returnedColumns: [],
      },
    });
    const result = await connectionRequestsService.listPublicFactoryMapPoints();
    expect(result.data[0].measurementPoints[0].data[0]).toMatchObject({ 'CO2 (ppm)': null });
    expect(result.data[0].measurementPoints[0].data[0]).not.toHaveProperty('CO2 (%)');
  });

  it('returns every visible popup parameter with the same completed-hour status rules', async () => {
    const result = await connectionRequestsService.listPublicFactoryMapPoints();
    expect(result.data[0].measurementPoints[0].latestMeasurement).toMatchObject({
      date: '2026-09-23',
      time: '09:00:00',
      values: {
        'CO (ppm)': { value: 999, status: 'exceeded' },
        'NOx (ppm)': { value: 10, status: 'normal' },
      },
    });
  });

  it('returns noData for all popup parameters instead of falling back to an older hour', async () => {
    jest.mocked(parameterValuesService.latestHourly).mockResolvedValue({
      data: [
        {
          station_id: 'S0001',
          cdate: '2026-09-23',
          ctime: '08:00:00',
          co_value: 5,
          co_units: 'ppm',
        },
      ],
      meta: {
        stationId: 'S0001',
        interval: '60m',
        schemaName: 'ingest',
        tableName: 'S0001_data_60m',
        count: 1,
        registeredParameters: ['CO (ppm)', 'NOx (ppm)'],
        returnedColumns: [],
      },
    });
    const result = await connectionRequestsService.listPublicFactoryMapPoints();
    expect(result.data[0].measurementPoints[0].data).toEqual([]);
    expect(result.data[0].measurementPoints[0].latestMeasurement).toEqual({
      date: '2026-09-23',
      time: '09:00:00',
      values: {
        'CO (ppm)': { value: null, displayValue: '-', status: 'noData' },
        'NOx (ppm)': { value: null, displayValue: '-', status: 'noData' },
      },
    });
    expect(result.data[0].hasLatestHourlyMeasurement).toBe(false);
  });

  it('returns noData for a missing popup parameter while retaining the measured parameter', async () => {
    jest.mocked(parameterValuesService.latestHourly).mockResolvedValue({
      data: [
        {
          station_id: 'S0001',
          cdate: '2026-09-23',
          ctime: '09:00:00',
          co_value: 5,
          co_units: 'ppm',
        },
      ],
      meta: {
        stationId: 'S0001',
        interval: '60m',
        schemaName: 'ingest',
        tableName: 'S0001_data_60m',
        count: 1,
        registeredParameters: ['CO (ppm)', 'NOx (ppm)'],
        returnedColumns: [],
      },
    });
    const result = await connectionRequestsService.listPublicFactoryMapPoints();
    expect(result.data[0].measurementPoints[0].latestMeasurement?.values).toMatchObject({
      'CO (ppm)': { value: 5, status: 'normal' },
      'NOx (ppm)': { value: null, status: 'noData' },
    });
  });

  it('combines parameters recorded at different times within the same completed hour', async () => {
    jest.mocked(parameterValuesService.latestHourly).mockResolvedValue({
      data: [
        {
          station_id: 'S0001',
          cdate: '2026-09-23',
          ctime: '09:30:00',
          nox_value: 10,
          nox_units: 'ppm',
        },
        {
          station_id: 'S0001',
          cdate: '2026-09-23',
          ctime: '09:00:00',
          co_value: 5,
          co_units: 'ppm',
        },
      ],
      meta: {
        stationId: 'S0001',
        interval: '60m',
        schemaName: 'ingest',
        tableName: 'S0001_data_60m',
        count: 2,
        registeredParameters: ['CO (ppm)', 'NOx (ppm)'],
        returnedColumns: [],
      },
    });
    const result = await connectionRequestsService.listPublicFactoryMapPoints();
    expect(parameterValuesService.latestHourly).toHaveBeenCalledWith(
      'S0001',
      { actorUserId: 0, scope: 'ALL' },
      { date: '2026-09-23', hour: 9 },
      { homeHour: true },
    );
    expect(result.data[0].measurementPoints[0].latestMeasurement?.values).toMatchObject({
      'CO (ppm)': { value: 5, status: 'normal' },
      'NOx (ppm)': { value: 10, status: 'normal' },
    });
  });

  it('keeps an explicit latest NoData status instead of falling back to an older value in the hour', async () => {
    jest.mocked(parameterValuesService.latestHourly).mockResolvedValue({
      data: [
        {
          station_id: 'S0001',
          cdate: '2026-09-23',
          ctime: '09:30:00',
          co_status: 0,
          co_units: 'ppm',
        },
        {
          station_id: 'S0001',
          cdate: '2026-09-23',
          ctime: '09:00:00',
          co_value: 50,
          co_status: 1,
          co_units: 'ppm',
        },
      ],
      meta: {
        stationId: 'S0001',
        interval: '60m',
        schemaName: 'ingest',
        tableName: 'S0001_data_60m',
        count: 2,
        registeredParameters: ['CO (ppm)', 'NOx (ppm)'],
        returnedColumns: [],
      },
    });
    const result = await connectionRequestsService.listPublicFactoryMapPoints();
    expect(result.data[0].measurementPoints[0].latestMeasurement?.values['CO (ppm)']).toMatchObject(
      {
        value: null,
        status: 'noData',
      },
    );
  });

  it('does not treat a missing estate lookup code as an outside-estate factory', async () => {
    jest.mocked(connectionRequestsRepository.listFactoriesForAccess).mockResolvedValue([
      {
        ...factory,
        industrialEstateName: ' นิคมใหม่ ',
        industrialEstateCode: null,
        industrialAreaType: 'OUTSIDE_INDUSTRIAL_ESTATE',
        industrialAreaTypeLabel: 'นอกนิคมอุตสาหกรรม',
      },
    ]);
    const result = await connectionRequestsService.listPublicFactoryMapPoints();
    expect(result.data[0]).toMatchObject({
      industrialEstateName: 'นิคมใหม่',
      industrialEstateCode: null,
      industrialAreaType: 'INDUSTRIAL_ESTATE',
      industrialAreaTypeLabel: 'ในนิคมอุตสาหกรรม',
    });
  });

  it('joins the selected eligible estate in legacy home reads without changing other menus', () => {
    const previousMode = env.FACTORY_PROFILE_MODE;
    try {
      env.FACTORY_PROFILE_MODE = 'legacy';
      const homeSql = buildConnectedFactoriesForAccessQueryForTests({
        actorUserId: 42,
        scope: 'ALL',
        homeDashboard: true,
      }).toSQL().sql;
      const menuSql = buildConnectedFactoriesForAccessQueryForTests({
        actorUserId: 42,
        scope: 'ALL',
      }).toSQL().sql;
      expect(homeSql).toContain(
        'LTRIM(RTRIM(ie.name_th)) = LTRIM(RTRIM(ef.industrial_estate_name))',
      );
      expect(homeSql).not.toContain('ie.id = f.industrial_estate_id');
      expect(menuSql).toContain('ie.id = f.industrial_estate_id');
    } finally {
      env.FACTORY_PROFILE_MODE = previousMode;
    }
  });

  it.each(['legacy', 'canonical'] as const)(
    'keeps home factories restricted to the assigned estate in %s mode',
    (mode) => {
      const previousMode = env.FACTORY_PROFILE_MODE;
      try {
        env.FACTORY_PROFILE_MODE = mode;
        for (const builder of [
          buildConnectedFactoriesForAccessQueryForTests,
          buildFactoriesForAccessQueryForTests,
        ]) {
          const query = builder({
            actorUserId: 42,
            homeDashboard: true,
            scope: { scope: 'IN_ESTATE', estate: 'IE-CURRENT', province: null, region: null },
          }).toSQL();
          // Execute the real permission query builder: the normalized estate lookup
          // must still feed an estate restriction with bound values, not all factories.
          expect(query.sql).toContain('[ie].[code] = ?');
          expect(query.sql).toContain('CAST(ie.id as varchar(32)) = ?');
          expect(query.bindings.filter((value) => value === 'IE-CURRENT')).toHaveLength(2);
          expect(query.sql).not.toContain('IE-CURRENT');
        }
      } finally {
        env.FACTORY_PROFILE_MODE = previousMode;
      }
    },
  );

  it('fails closed when a home estate-scoped actor has no assigned estate', () => {
    for (const builder of [
      buildConnectedFactoriesForAccessQueryForTests,
      buildFactoriesForAccessQueryForTests,
    ]) {
      const query = builder({
        actorUserId: 42,
        homeDashboard: true,
        scope: { scope: 'IN_ESTATE', estate: null, province: null, region: null },
      }).toSQL();
      expect(query.sql).toContain('1 = 0');
    }
  });
});
