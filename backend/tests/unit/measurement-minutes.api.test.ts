import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { signTestAccessToken } from '../helpers/live-authorization-fixture';

// Only persistence adapters are replaced; the HTTP and service flow runs unchanged.
jest.mock('../../src/modules/connection-requests/connection-requests.repository', () => ({
  connectionRequestsRepository: {
    list: jest.fn(),
    findFactorySummariesForRequests: jest.fn(),
    listConnectedMeasurementPointsForFactories: jest.fn(),
    getHomeMeasurementPointVisibility: jest.fn(),
  },
}));
jest.mock('../../src/modules/device-connections/device-connections.repository', () => ({
  deviceConnectionsRepository: { list: jest.fn() },
}));
jest.mock('../../src/modules/parameter-values/parameter-values.repository', () => ({
  parameterValuesRepository: {
    canAccessStation: jest.fn(),
    stationExists: jest.fn(),
    tableExists: jest.fn(),
    listMinuteRows: jest.fn(),
    tableName: (id: string) => `${id}_data_1m`,
  },
}));
import { connectedMeasurementPointsRoutes } from '../../src/modules/connection-requests/connected-measurement-points.routes';
import { errorHandler, notFoundHandler } from '../../src/shared/middlewares/errorHandler';
import { connectionRequestsRepository as connections } from '../../src/modules/connection-requests/connection-requests.repository';
import { parameterValuesRepository as measurements } from '../../src/modules/parameter-values/parameter-values.repository';
import { deviceConnectionsRepository as devices } from '../../src/modules/device-connections/device-connections.repository';

const app = express();
app.use('/api/v1/connected-measurement-points', connectedMeasurementPointsRoutes);
app.use(notFoundHandler);
app.use(errorHandler);
const path = '/api/v1/connected-measurement-points/S0199/measurement-minutes';
let token: string;
beforeEach(() => {
  jest.clearAllMocks();
  token = signTestAccessToken({
    sub: '42',
    userType: 'officer',
    roles: ['officer'],
    scopes: { 'dashboard.stats:view': 'ALL' },
  });
  jest.mocked(connections.list).mockResolvedValue({
    rows: [
      {
        id: 10,
        requestNo: 'TEST',
        factoryId: 'F1',
        factoryRegistrationNo: 'F1',
        systemType: 'CEMS',
        status: 'CONNECTED',
        verifiedAt: null,
        measurementPoints: [
          { id: 1, pointCode: 'S0199', pointName: 'Stack', parameters: ['CO (ppm)'] },
        ],
      },
    ],
    total: 1,
  } as Awaited<ReturnType<typeof connections.list>>);
  jest.mocked(connections.findFactorySummariesForRequests).mockResolvedValue(new Map());
  jest.mocked(connections.listConnectedMeasurementPointsForFactories).mockResolvedValue([
    {
      sourceMeasurementPointId: 1,
      sourceRequestId: 10,
      pointCode: 'S0199',
      pointName: 'Stack',
      parameters: ['CO (ppm)'],
    },
  ] as Awaited<ReturnType<typeof connections.listConnectedMeasurementPointsForFactories>>);
  jest.mocked(connections.getHomeMeasurementPointVisibility).mockResolvedValue({
    factoryVisible: true,
    pointVisible: true,
    fullyExempt: false,
    parameters: ['CO (ppm)'],
    measurementInstruments: null,
  });
  jest.mocked(devices.list).mockResolvedValue([]);
  jest.mocked(measurements.canAccessStation).mockResolvedValue(true);
  jest.mocked(measurements.stationExists).mockResolvedValue(true);
  jest.mocked(measurements.tableExists).mockResolvedValue(true);
  jest.mocked(measurements.listMinuteRows).mockResolvedValue([
    {
      cdate: '2026-11-11',
      ctime: '09:00:00',
      co_value: 12.3456789,
      co_status: 4,
      co_units: 'ppm',
    },
  ]);
});
describe('minute measurements HTTP contract', () => {
  it('rejects an impossible statistics date with a validation error', async () => {
    const response = await request(app)
      .get('/api/v1/connected-measurement-points/S0199/measurement-statistics')
      .query({ date: '2026-02-30' })
      .auth(token, { type: 'bearer' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('keeps the stored value and operational status in a 60-minute grid', async () => {
    const response = await request(app)
      .get(path)
      .query({ date: '2026-11-11', hour: '09' })
      .auth(token, { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      stationId: 'S0199',
      pointName: 'Stack',
      date: '2026-11-11',
      hour: '09',
      timezone: 'Asia/Bangkok',
      parameters: ['CO (ppm)'],
    });
    expect(response.body.data.rows).toHaveLength(60);
    expect(response.body.data.rows[0]).toEqual({
      time: '09:00',
      values: {
        'CO (ppm)': {
          value: 12.3456789,
          status: 'Maintenance',
          sourceStatus: 4,
          measuredAt: '2026-11-11T09:00:00+07:00',
        },
      },
    });
    expect(response.body.data.rows[59]).toEqual({
      time: '09:59',
      values: { 'CO (ppm)': { value: null, status: null, sourceStatus: null, measuredAt: null } },
    });
    expect(response.body.meta).toMatchObject({ interval: '1m', minutesWithData: 1 });
  });
});

it('selects the latest sample per parameter without mixing units or dropping status-only values', async () => {
  jest.mocked(connections.getHomeMeasurementPointVisibility).mockResolvedValue({
    factoryVisible: true,
    pointVisible: true,
    fullyExempt: false,
    parameters: ['CO (ppm)', 'CO (%)'],
    measurementInstruments: null,
  });
  jest.mocked(measurements.listMinuteRows).mockResolvedValue([
    { cdate: '2026-11-11', ctime: '09:00:00', co_value: 1.5, co_status: 1, co_units: 'ppm' },
    { cdate: '2026-11-11', ctime: '09:00:30', co_value: null, co_status: 6, co_units: 'ppm' },
    { cdate: '2026-11-11', ctime: '09:00:10', co_value: 0, co_status: 1, co_units: '%' },
  ]);
  const response = await request(app)
    .get(path)
    .query({ date: '2026-11-11', hour: '09' })
    .auth(token, { type: 'bearer' });
  expect(response.status).toBe(200);
  expect(response.body.data.rows[0].values).toEqual({
    'CO (ppm)': {
      value: null,
      status: 'Shut Down',
      sourceStatus: 6,
      measuredAt: '2026-11-11T09:00:30+07:00',
    },
    'CO (%)': {
      value: 0,
      status: 'Normal',
      sourceStatus: 1,
      measuredAt: '2026-11-11T09:00:10+07:00',
    },
  });
});

it('rejects an out-of-scope station before reading its minute data', async () => {
  jest.mocked(measurements.canAccessStation).mockResolvedValue(false);
  const response = await request(app)
    .get(path)
    .query({ date: '2026-11-11', hour: '09' })
    .auth(token, { type: 'bearer' });
  expect(response.status).toBe(403);
  expect(response.body.error.code).toBe('FORBIDDEN');
  expect(measurements.listMinuteRows).not.toHaveBeenCalled();
  expect(connections.list).not.toHaveBeenCalled();
});

it.each(['2026-02-30', '2026-99-99', 'not-a-date'])(
  'returns validation errors for invalid calendar date %s',
  async (date) => {
    const response = await request(app)
      .get(path)
      .query({ date, hour: '09' })
      .auth(token, { type: 'bearer' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(measurements.listMinuteRows).not.toHaveBeenCalled();
  },
);

it('returns null for a missing or nonnumeric value without losing its source status', async () => {
  jest.mocked(measurements.listMinuteRows).mockResolvedValue([
    { cdate: '2026-11-11', ctime: '09:00:00', co_value: '', co_status: 0, co_units: 'ppm' },
    {
      cdate: '2026-11-11',
      ctime: '09:01:00',
      co_value: 'not-a-number',
      co_status: 9,
      co_units: 'ppm',
    },
    {
      cdate: '2026-11-11',
      ctime: '09:02:00',
      co_value: '12.345678901234567890',
      co_status: 'Normal',
      co_units: 'ppm',
    },
  ]);
  const response = await request(app)
    .get(path)
    .query({ date: '2026-11-11', hour: '09' })
    .auth(token, { type: 'bearer' });
  expect(response.status).toBe(200);
  expect(response.body.data.rows[0].values['CO (ppm)']).toMatchObject({
    value: null,
    status: 'Etc.',
    sourceStatus: 0,
  });
  expect(response.body.data.rows[1].values['CO (ppm)']).toMatchObject({
    value: null,
    status: 'Etc.',
    sourceStatus: 9,
  });
  expect(response.body.data.rows[2].values['CO (ppm)']).toMatchObject({
    value: '12.345678901234567890',
    status: 'Normal',
    sourceStatus: 'Normal',
  });
});

it('requires authentication', async () => {
  expect((await request(app).get(path).query({ date: '2026-11-11', hour: '09' })).status).toBe(401);
  expect(measurements.listMinuteRows).not.toHaveBeenCalled();
});
it('requires statistics view permission', async () => {
  const other = signTestAccessToken({
    sub: '42',
    userType: 'officer',
    roles: ['officer'],
    scopes: { 'cems_wpms_requests:view': 'ALL' },
  });
  expect(
    (
      await request(app)
        .get(path)
        .query({ date: '2026-11-11', hour: '09' })
        .auth(other, { type: 'bearer' })
    ).status,
  ).toBe(403);
});
it.each(['24', '-1', '9', '09:00', '09 OR 1=1'])('rejects invalid hour %s', async (hour) => {
  const response = await request(app)
    .get(path)
    .query({ date: '2026-11-11', hour })
    .auth(token, { type: 'bearer' });
  expect(response.status).toBe(400);
  expect(response.body.error.code).toBe('VALIDATION_ERROR');
  expect(measurements.listMinuteRows).not.toHaveBeenCalled();
});
it('rejects missing or additional query fields and unsafe station identifiers', async () => {
  for (const query of [
    { date: '2026-11-11' },
    { date: '2026-11-11', hour: '09', startDate: '2026-01-01' },
  ]) {
    expect((await request(app).get(path).query(query).auth(token, { type: 'bearer' })).status).toBe(
      400,
    );
  }
  expect(
    (
      await request(app)
        .get(path.replace('S0199', 'S0199%3BDROP'))
        .query({ date: '2026-11-11', hour: '09' })
        .auth(token, { type: 'bearer' })
    ).status,
  ).toBe(400);
});
it.each([{ factoryVisible: false }, { pointVisible: false }, { fullyExempt: true }])(
  'does not expose hidden or exempt data %j',
  async (blocked) => {
    jest.mocked(connections.getHomeMeasurementPointVisibility).mockResolvedValue({
      factoryVisible: true,
      pointVisible: true,
      fullyExempt: false,
      parameters: ['CO (ppm)'],
      measurementInstruments: null,
      ...blocked,
    });
    const response = await request(app)
      .get(path)
      .query({ date: '2026-11-11', hour: '09' })
      .auth(token, { type: 'bearer' });
    expect(response.status).toBe(404);
    expect(measurements.listMinuteRows).not.toHaveBeenCalled();
  },
);
it('returns an empty grid with 200 and prevents caching when the hour has no samples', async () => {
  jest.mocked(measurements.listMinuteRows).mockResolvedValue([]);
  const response = await request(app)
    .get(path)
    .query({ date: '2026-11-11', hour: '09' })
    .auth(token, { type: 'bearer' });
  expect(response.status).toBe(200);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.body.meta.minutesWithData).toBe(0);
  expect(response.body.data.rows).toHaveLength(60);
  expect(
    response.body.data.rows.every((row: { values: Record<string, unknown> }) =>
      Object.values(row.values).every(
        (cell) =>
          JSON.stringify(cell) ===
          '{"value":null,"status":null,"sourceStatus":null,"measuredAt":null}',
      ),
    ),
  ).toBe(true);
});
it('returns 404 without exposing physical source names when the minute table is missing', async () => {
  jest.mocked(measurements.tableExists).mockResolvedValue(false);
  const response = await request(app)
    .get(path)
    .query({ date: '2026-11-11', hour: '09' })
    .auth(token, { type: 'bearer' });
  expect(response.status).toBe(404);
  expect(JSON.stringify(response.body)).not.toContain('_data_1m');
  expect(measurements.listMinuteRows).not.toHaveBeenCalled();
});
it('returns 404 for an unknown station', async () => {
  jest.mocked(measurements.canAccessStation).mockResolvedValue(false);
  jest.mocked(measurements.stationExists).mockResolvedValue(false);
  expect(
    (
      await request(app)
        .get(path)
        .query({ date: '2026-11-11', hour: '09' })
        .auth(token, { type: 'bearer' })
    ).status,
  ).toBe(404);
});
it('resolves samples sharing a minute by measured time then sent time consistently', async () => {
  const rows = [
    {
      cdate: '2026-11-11',
      ctime: '09:00:10',
      udate: '2026-11-11',
      utime: '09:01:00',
      co_value: 1,
      co_status: 1,
      co_units: 'ppm',
    },
    {
      cdate: '2026-11-11',
      ctime: '09:00:20',
      udate: '2026-11-11',
      utime: '09:01:00',
      co_value: 2,
      co_status: 1,
      co_units: 'ppm',
    },
    {
      cdate: '2026-11-11',
      ctime: '09:00:20',
      udate: '2026-11-11',
      utime: '09:02:00',
      co_value: 3,
      co_status: 1,
      co_units: 'ppm',
    },
  ];
  for (const samples of [rows, [...rows].reverse()]) {
    jest.mocked(measurements.listMinuteRows).mockResolvedValue(samples);
    const response = await request(app)
      .get(path)
      .query({ date: '2026-11-11', hour: '09' })
      .auth(token, { type: 'bearer' });
    expect(response.body.data.rows[0].values['CO (ppm)'].value).toBe(3);
  }
});
it.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])('retains value and raw status code %s', async (code) => {
  const expected = [
    'Etc.',
    'Normal',
    'Calibration',
    'Defective',
    'Maintenance',
    'Start up',
    'Shut Down',
    'Turnaround',
    'Etc.',
    'Etc.',
  ];
  jest
    .mocked(measurements.listMinuteRows)
    .mockResolvedValue([
      { cdate: '2026-11-11', ctime: '09:00:00', co_value: 0, co_status: code, co_units: 'ppm' },
    ]);
  const response = await request(app)
    .get(path)
    .query({ date: '2026-11-11', hour: '09' })
    .auth(token, { type: 'bearer' });
  expect(response.body.data.rows[0].values['CO (ppm)']).toMatchObject({
    value: 0,
    status: expected[code],
    sourceStatus: code,
  });
});

it('canonicalizes legacy Flow labels and reads unit-specific columns without borrowing another unit', async () => {
  jest.mocked(connections.getHomeMeasurementPointVisibility).mockResolvedValue({
    factoryVisible: true,
    pointVisible: true,
    fullyExempt: false,
    parameters: ['Flow', 'Flow Rate (m³/hr)', 'CO2 (ppm)', 'CO2 (%)'],
    measurementInstruments: null,
  });
  jest.mocked(measurements.listMinuteRows).mockResolvedValue([
    {
      cdate: '2026-11-11',
      ctime: '09:00:00',
      flow_value: 25,
      flow_status: 1,
      co2_ppm_value: 100,
      co2_ppm_status: 2,
      co2_percent_value: null,
      co2_percent_status: 4,
    },
  ]);
  const response = await request(app)
    .get(path)
    .query({ date: '2026-11-11', hour: '09' })
    .auth(token, { type: 'bearer' });
  expect(response.status).toBe(200);
  expect(response.body.data.parameters).toEqual(['Flow Rate (m3/hr)', 'CO2 (ppm)', 'CO2 (%)']);
  expect(response.body.data.rows[0].values).toMatchObject({
    'Flow Rate (m3/hr)': { value: 25, status: 'Normal' },
    'CO2 (ppm)': { value: 100, status: 'Calibration' },
    'CO2 (%)': { value: null, status: 'Maintenance' },
  });
});

it.each(['CEMS-0001%2F2569', 'CEMS-0001/2569'])(
  'supports annual station path %s',
  async (stationPath) => {
    jest.mocked(connections.list).mockResolvedValue({
      rows: [
        {
          id: 10,
          requestNo: 'TEST',
          factoryId: 'F1',
          factoryRegistrationNo: 'F1',
          systemType: 'CEMS',
          status: 'CONNECTED',
          verifiedAt: null,
          measurementPoints: [
            { id: 1, pointCode: 'CEMS-0001/2569', pointName: 'Stack', parameters: ['CO (ppm)'] },
          ],
        },
      ],
      total: 1,
    } as Awaited<ReturnType<typeof connections.list>>);
    jest.mocked(connections.listConnectedMeasurementPointsForFactories).mockResolvedValue([
      {
        sourceMeasurementPointId: 1,
        sourceRequestId: 10,
        pointCode: 'CEMS-0001/2569',
        pointName: 'Stack',
        parameters: ['CO (ppm)'],
      },
    ] as Awaited<ReturnType<typeof connections.listConnectedMeasurementPointsForFactories>>);
    const response = await request(app)
      .get(`/api/v1/connected-measurement-points/${stationPath}/measurement-minutes`)
      .query({ date: '2026-11-11', hour: '09' })
      .auth(token, { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.data.stationId).toBe('CEMS-0001/2569');
  },
);

it('does not guess between ambiguous or wrong-unit source families', async () => {
  jest.mocked(connections.getHomeMeasurementPointVisibility).mockResolvedValue({
    factoryVisible: true,
    pointVisible: true,
    fullyExempt: false,
    parameters: ['Flow Rate (m3/hr)', 'CO (ppm)', 'CO (%)'],
    measurementInstruments: null,
  });
  jest.mocked(measurements.listMinuteRows).mockResolvedValue([
    {
      cdate: '2026-11-11',
      ctime: '09:00:00',
      flow_value: 1,
      flow_status: 1,
      flow_units: 'm3/hr',
      flow_rate_value: 2,
      flow_rate_status: 1,
      flow_rate_units: 'm3/hr',
      co_value: 5,
      co_status: 1,
    },
  ]);
  const response = await request(app)
    .get(path)
    .query({ date: '2026-11-11', hour: '09' })
    .auth(token, { type: 'bearer' });
  expect(response.status).toBe(200);
  expect(response.body.meta.minutesWithData).toBe(0);
  expect(response.body.data.rows[0].values).toMatchObject({
    'Flow Rate (m3/hr)': { value: null, status: null },
    'CO (ppm)': { value: null, status: null },
    'CO (%)': { value: null, status: null },
  });
});

it('does not infer a unit from visibility when another registered unit is hidden', async () => {
  jest.mocked(connections.listConnectedMeasurementPointsForFactories).mockResolvedValue([
    {
      sourceMeasurementPointId: 1,
      sourceRequestId: 10,
      pointCode: 'S0199',
      pointName: 'Stack',
      parameters: ['CO (ppm)', 'CO (%)'],
    },
  ] as Awaited<ReturnType<typeof connections.listConnectedMeasurementPointsForFactories>>);
  jest
    .mocked(measurements.listMinuteRows)
    .mockResolvedValue([{ cdate: '2026-11-11', ctime: '09:00:00', co_value: 50, co_status: 1 }]);
  const response = await request(app)
    .get(path)
    .query({ date: '2026-11-11', hour: '09' })
    .auth(token, { type: 'bearer' });
  expect(response.status).toBe(200);
  expect(response.body.data.parameters).toEqual(['CO (ppm)']);
  expect(response.body.data.rows[0].values['CO (ppm)']).toMatchObject({
    value: null,
    status: null,
  });
});

it('reads legacy Flow without source units when the live registration also uses Flow', async () => {
  jest.mocked(connections.listConnectedMeasurementPointsForFactories).mockResolvedValue([
    {
      sourceMeasurementPointId: 1,
      sourceRequestId: 10,
      pointCode: 'S0199',
      pointName: 'Stack',
      parameters: ['Flow'],
    },
  ] as Awaited<ReturnType<typeof connections.listConnectedMeasurementPointsForFactories>>);
  jest.mocked(connections.getHomeMeasurementPointVisibility).mockResolvedValue({
    factoryVisible: true,
    pointVisible: true,
    fullyExempt: false,
    parameters: ['Flow'],
    measurementInstruments: null,
  });
  jest.mocked(measurements.listMinuteRows).mockResolvedValue([
    {
      cdate: '2026-11-11',
      ctime: '09:00:00',
      flow_value: 25,
      flow_status: 1,
    },
  ]);
  const response = await request(app)
    .get(path)
    .query({ date: '2026-11-11', hour: '09' })
    .auth(token, { type: 'bearer' });
  expect(response.status).toBe(200);
  expect(response.body.data.parameters).toEqual(['Flow Rate (m3/hr)']);
  expect(response.body.data.rows[0].values['Flow Rate (m3/hr)']).toMatchObject({
    value: 25,
    status: 'Normal',
  });
  expect(response.body.meta.minutesWithData).toBe(1);
});

function registerMinuteParameters(parameters: string[], visible = parameters): void {
  jest.mocked(connections.listConnectedMeasurementPointsForFactories).mockResolvedValue([
    {
      sourceMeasurementPointId: 1,
      sourceRequestId: 10,
      pointCode: 'S0199',
      pointName: 'Stack',
      parameters,
    },
  ] as Awaited<ReturnType<typeof connections.listConnectedMeasurementPointsForFactories>>);
  jest.mocked(connections.getHomeMeasurementPointVisibility).mockResolvedValue({
    factoryVisible: true,
    pointVisible: true,
    fullyExempt: false,
    parameters: visible,
    measurementInstruments: null,
  });
}

it.each(['DegC', 'C°', '°C', null])(
  'returns stored temperature and status for source unit %s',
  async (unit) => {
    registerMinuteParameters(['Temp. (C°)']);
    jest.mocked(measurements.listMinuteRows).mockResolvedValue([
      {
        cdate: '2026-11-12',
        ctime: '08:00:00',
        temp_value: '150.77',
        temp_units: unit,
        temp_status: '1',
      },
    ]);
    const response = await request(app)
      .get(path)
      .query({ date: '2026-11-12', hour: '08' })
      .auth(token, { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.data.rows[0].values['Temp. (C°)']).toEqual({
      value: '150.77',
      status: 'Normal',
      sourceStatus: '1',
      measuredAt: '2026-11-12T08:00:00+07:00',
    });
    expect(response.body.meta.minutesWithData).toBe(1);
  },
);

it('returns a bare registered parameter with the unambiguous source unit and stored value', async () => {
  registerMinuteParameters(['CO']);
  jest.mocked(measurements.listMinuteRows).mockResolvedValue([
    {
      cdate: '2026-11-11',
      ctime: '09:00:00',
      co_value: 50,
      co_status: 1,
      co_units: 'ppm',
    },
  ]);
  const response = await request(app)
    .get(path)
    .query({ date: '2026-11-11', hour: '09' })
    .auth(token, { type: 'bearer' });
  expect(response.status).toBe(200);
  expect(response.body.data.parameters).toEqual(['CO (ppm)']);
  expect(response.body.data.rows[0].values['CO (ppm)']).toMatchObject({
    value: 50,
    status: 'Normal',
  });
  expect(response.body.meta.minutesWithData).toBe(1);
});

it('reports ambiguous bare-parameter units rather than returning an unlabelled or hidden-unit value', async () => {
  registerMinuteParameters(['CO', 'CO (%)'], ['CO']);
  jest.mocked(measurements.listMinuteRows).mockResolvedValue([
    {
      cdate: '2026-11-11',
      ctime: '09:00:00',
      co_value: 50,
      co_status: 1,
      co_units: 'ppm',
    },
  ]);
  const response = await request(app)
    .get(path)
    .query({ date: '2026-11-11', hour: '09' })
    .auth(token, { type: 'bearer' });
  expect(response.status).toBe(503);
  expect(response.body).toMatchObject({
    success: false,
    error: { code: 'MEASUREMENT_PARAMETER_UNIT_UNAVAILABLE' },
  });
  expect(response.body.data).toBeUndefined();
});

it('keeps the resolved unit on status-only and unitless samples in the same hour', async () => {
  registerMinuteParameters(['CO']);
  jest.mocked(measurements.listMinuteRows).mockResolvedValue([
    { cdate: '2026-11-11', ctime: '09:00:00', co_value: 50, co_status: 1, co_units: 'ppm' },
    { cdate: '2026-11-11', ctime: '09:01:00', co_value: null, co_status: 4 },
    { cdate: '2026-11-11', ctime: '09:02:00', co_value: 0, co_status: 6 },
  ]);
  const response = await request(app)
    .get(path)
    .query({ date: '2026-11-11', hour: '09' })
    .auth(token, { type: 'bearer' });
  expect(response.status).toBe(200);
  expect(response.body.data.rows[1].values['CO (ppm)']).toMatchObject({
    value: null,
    status: 'Maintenance',
  });
  expect(response.body.data.rows[2].values['CO (ppm)']).toMatchObject({
    value: 0,
    status: 'Shut Down',
  });
  expect(response.body.meta.minutesWithData).toBe(3);
});

it('uses registered unit metadata to label a bare name when the selected hour is empty', async () => {
  registerMinuteParameters(['CO', 'CO (ppm)'], ['CO']);
  jest.mocked(measurements.listMinuteRows).mockResolvedValue([]);
  const response = await request(app)
    .get(path)
    .query({ date: '2026-11-11', hour: '09' })
    .auth(token, { type: 'bearer' });
  expect(response.status).toBe(200);
  expect(response.body.data.parameters).toEqual(['CO (ppm)']);
  expect(response.body.data.rows).toHaveLength(60);
  expect(response.body.meta.minutesWithData).toBe(0);
});

it.each([
  { rows: [] },
  { rows: [{ cdate: '2026-11-11', ctime: '09:00:00', co_value: 50, co_status: 1 }] },
  {
    rows: [
      { cdate: '2026-11-11', ctime: '09:00:00', co_value: 50, co_status: 1, co_units: 'ppm' },
      { cdate: '2026-11-11', ctime: '09:01:00', co_value: 2, co_status: 1, co_units: '%' },
    ],
  },
])('reports unresolved bare-name units without inventing a display unit: %j', async ({ rows }) => {
  registerMinuteParameters(['CO']);
  jest.mocked(measurements.listMinuteRows).mockResolvedValue(rows);
  const response = await request(app)
    .get(path)
    .query({ date: '2026-11-11', hour: '09' })
    .auth(token, { type: 'bearer' });
  expect(response.status).toBe(503);
  expect(response.body.error.code).toBe('MEASUREMENT_PARAMETER_UNIT_UNAVAILABLE');
  expect(response.body.data).toBeUndefined();
});

it('does not require a physical unit for dimensionless pH', async () => {
  registerMinuteParameters(['pH']);
  jest.mocked(measurements.listMinuteRows).mockResolvedValue([
    {
      cdate: '2026-11-11',
      ctime: '09:00:00',
      ph_value: 7.25,
      ph_status: 1,
    },
  ]);
  const response = await request(app)
    .get(path)
    .query({ date: '2026-11-11', hour: '09' })
    .auth(token, { type: 'bearer' });
  expect(response.status).toBe(200);
  expect(response.body.data.rows[0].values.pH).toMatchObject({ value: 7.25, status: 'Normal' });
});

it('deduplicates bare and unit-qualified labels after resolving their unit', async () => {
  registerMinuteParameters(['CO', 'CO (ppm)']);
  jest.mocked(measurements.listMinuteRows).mockResolvedValue([
    {
      cdate: '2026-11-11',
      ctime: '09:00:00',
      co_value: 50,
      co_status: 1,
      co_units: 'ppm',
    },
  ]);
  const response = await request(app)
    .get(path)
    .query({ date: '2026-11-11', hour: '09' })
    .auth(token, { type: 'bearer' });
  expect(response.status).toBe(200);
  expect(response.body.data.parameters).toEqual(['CO (ppm)']);
  expect(response.body.data.rows[0].values['CO (ppm)'].value).toBe(50);
});
