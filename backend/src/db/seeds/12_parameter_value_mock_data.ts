import createKnex, { type Knex } from 'knex';

const OPERATOR_EXTERNAL_ID = '3191000135709';
const FACTORY_FID = '10190003325500';
const MOCK_DATES = ['2026-06-09'];
const MOCK_INTERVALS = ['real', '1m', '5m', '60m', '1day', 'test'] as const;
const MIN_MOCK_PARAMETER_COUNT = 100;
const TEMPLATE_TABLE_INTERVAL = '60m';
const PASTED_PARAMETER_COLUMN_PREFIXES = [
  'co2',
  'co',
  'flow',
  'flow2',
  'h2s',
  'hcl',
  'hg',
  'moisture',
  'nox',
  'o2',
  'o3',
  'opacity',
  'particulate',
  'pressure',
  'pressure_instack',
  'so2',
  'sox',
  'temp',
  'trs',
  'tsp',
  'loading',
  'bod',
  'cod',
  'cod2',
  'watt',
  'tetrachloroethane',
  'dibromoethane',
  'dichloroethane',
  'dichloropropane',
  'dutadiene',
  'dichlorobenzene',
  'dioxane',
  'propenal_acrolein',
  'acenaphthene',
  'acenaphthylene',
  'acetaldehyde',
  'acrolein',
  'acrylonitrile',
  'aldrin',
  'alpha',
  'alpha_bhc',
  'anthracene',
  'as',
  'ba',
  'battery',
  'ben',
  'benzene',
  'benzyl_chloride',
  'beta',
  'bga',
  'bp',
  'bromomethane',
  'carbon_tetrachloride',
  'cd',
  'ch4',
  'chloroform',
  'chl',
  'color',
  'conductivity',
  'cond',
  'cr3',
  'cr6',
  'cs2',
  'cu',
  'cyanide',
  'ddt',
  'dichloromethane',
  'dieldrin',
  'do',
  'dust',
  'endrin',
  'eth',
  'ethylben',
  'ethylbenzene',
  'fecal_coliform',
  'fluoranthene',
  'free_chlorine',
  'fuorene',
  'heptachor',
  'level',
  'mn',
  'mpxylene',
  'mpxy',
  'naphthalene',
  'nh3',
  'ni',
  'no',
  'no2',
  'no3',
  'noise',
  'nrad',
  'odour',
  'oxylene',
  'oxyl',
  'pb',
  'ph',
  'phenanthrene',
  'phenols',
  'pm1_0',
  'pm2_5',
  'pm10',
  'pm100',
  'rain',
  'rh',
  'sal',
  'sd',
  'se',
  'solar',
  'srad',
  'styrene',
  'tds',
  'tetrachloroethylene',
  'thcnm',
  'thc',
  'toluene',
  'tol',
  'total_coliform',
  'total_organochlorine',
  'trichloroethene',
  'trichloroethylene',
  'tss',
  'turb',
  'vinyl_chloride',
  'vocl',
  'vocs',
  'wd',
  'ws',
  'xylene',
  'zn',
] as const;

export const PARAMETER_VALUE_MOCK_STATUSES = ['Normal', 'Maintenance', 'Shut Down'] as const;

type ParameterValueMockStatus = (typeof PARAMETER_VALUE_MOCK_STATUSES)[number];

export interface ParameterValueMockParameter {
  label: string;
  columnPrefix: string;
  unit: string;
  baseValue: number;
  step: number;
}

export interface ParameterValueMockStation {
  stationId: string;
  requestNo: string;
  systemType: 'CEMS' | 'WPMS';
  pointType: 'STACK' | 'WASTEWATER';
  pointName: string;
  description: string;
  parameters: ParameterValueMockParameter[];
}

const BASE_PARAMETER_VALUE_MOCK_STATIONS: ParameterValueMockStation[] = [
  {
    stationId: 'S00001',
    requestNo: 'CEMS-DEMO-S00001',
    systemType: 'CEMS',
    pointType: 'STACK',
    pointName: 'S00001',
    description: 'Demo CEMS station with all common stack parameters',
    parameters: buildPastedSchemaMockParameters(),
  },
  {
    stationId: 'P0001',
    requestNo: 'WPMS-DEMO-P0001',
    systemType: 'WPMS',
    pointType: 'WASTEWATER',
    pointName: 'P0001',
    description: 'Demo WPMS station with all common wastewater parameters',
    parameters: buildPastedSchemaMockParameters(),
  },
];

export async function seed(knex: Knex): Promise<void> {
  const canSeedMainDb = await hasRequiredMainTables(knex);
  const parameterDb = createParameterSourceKnex(knex);

  try {
    const mockStations = await resolveMockStations(parameterDb);

    if (canSeedMainDb) {
      await seedConnectedMeasurementPoints(knex, mockStations);
    }

    await seedParameterValueTables(parameterDb, mockStations);
  } finally {
    await parameterDb.destroy();
  }
}

export const PARAMETER_VALUE_MOCK_STATIONS: ParameterValueMockStation[] =
  BASE_PARAMETER_VALUE_MOCK_STATIONS.map(ensureMinimumMockParameters);

export function buildParameterValueMockRows(
  station: ParameterValueMockStation,
  date: string,
): Record<string, unknown>[] {
  return Array.from({ length: 24 }, (_, hour) => {
    const row: Record<string, unknown> = {
      station_id: station.stationId,
      cdate: date,
      ctime: `${String(hour).padStart(2, '0')}:00:00`,
      udate: date,
      utime: `${String(hour).padStart(2, '0')}:00:00`,
      data_completeness_percent: 85,
    };

    station.parameters.forEach((parameter, parameterIndex) => {
      row[`${parameter.columnPrefix}_value`] = buildMockValue(parameter, hour, parameterIndex);
      row[`${parameter.columnPrefix}_units`] = parameter.unit || null;
      row[`${parameter.columnPrefix}_status`] = buildMockStatus(hour, parameterIndex);
    });

    return row;
  });
}

async function hasRequiredMainTables(knex: Knex): Promise<boolean> {
  const checks = await Promise.all([
    knex.schema.hasTable('users'),
    knex.schema.hasTable('factories'),
    knex.schema.hasTable('cems_wpms_connection_requests'),
    knex.schema.hasTable('cems_wpms_measurement_points'),
    knex.schema.hasTable('cems_wpms_connected_measurement_points'),
  ]);

  return checks.every(Boolean);
}

async function seedConnectedMeasurementPoints(
  knex: Knex,
  stations: ParameterValueMockStation[],
): Promise<void> {
  const user = await knex('users')
    .where({ identity_provider: 'mock', external_id: OPERATOR_EXTERNAL_ID })
    .first('id', 'email', 'phone', 'first_name', 'last_name');
  if (!user) return;

  const factory = await knex('factories').where({ fid: FACTORY_FID }).first('fid', 'code', 'name');
  if (!factory) return;

  for (const station of stations) {
    const requestId = await upsertConnectionRequest(knex, station, {
      userId: Number(user.id),
      factoryId: factory.fid,
      factoryName: factory.name,
      factoryRegistrationNo: factory.code,
      contactName: `${user.first_name} ${user.last_name}`.trim(),
      contactPhone: user.phone ?? '0999454594',
      contactEmail: user.email,
    });
    const measurementPointId = await upsertMeasurementPoint(
      knex,
      station,
      requestId,
      Number(user.id),
    );

    await upsertConnectedMeasurementPoint(knex, station, {
      requestId,
      measurementPointId,
      userId: Number(user.id),
      factoryId: factory.fid,
      factoryName: factory.name,
      factoryRegistrationNo: factory.code,
    });
    await insertStatusHistory(knex, requestId, Number(user.id), station.stationId);
  }
}

async function upsertConnectionRequest(
  knex: Knex,
  station: ParameterValueMockStation,
  payload: {
    userId: number;
    factoryId: string;
    factoryName: string;
    factoryRegistrationNo: string;
    contactName: string;
    contactPhone: string;
    contactEmail: string | null;
  },
): Promise<number> {
  const existing = await knex('cems_wpms_connection_requests')
    .where({ request_no: station.requestNo })
    .first('id');

  const requestPayload = {
    request_type: 'NEW_CONNECTION',
    factory_id: payload.factoryId,
    factory_name: payload.factoryName,
    factory_registration_no: payload.factoryRegistrationNo,
    system_type: station.systemType,
    status: 'CONNECTED',
    contact_name: payload.contactName || 'operator_demo',
    contact_phone: payload.contactPhone,
    contact_email: payload.contactEmail,
    remarks: station.description,
    confirmed_at: knex.raw('SYSDATETIME()'),
    verified_at: knex.raw('SYSDATETIME()'),
    updated_by: payload.userId,
    updated_at: knex.raw('SYSDATETIME()'),
  };

  if (existing) {
    await knex('cems_wpms_connection_requests').where({ id: existing.id }).update(requestPayload);
    return Number(existing.id);
  }

  const [inserted] = await knex('cems_wpms_connection_requests')
    .insert({
      request_no: station.requestNo,
      ...requestPayload,
      created_by: payload.userId,
    })
    .returning('id');

  return Number(inserted.id);
}

async function upsertMeasurementPoint(
  knex: Knex,
  station: ParameterValueMockStation,
  requestId: number,
  userId: number,
): Promise<number> {
  const existing = await knex('cems_wpms_measurement_points')
    .where({ request_id: requestId, point_code: station.stationId })
    .first('id');

  const pointPayload = {
    point_name: station.pointName,
    point_type: station.pointType,
    parameters_json: JSON.stringify(station.parameters.map((parameter) => parameter.label)),
    description: station.description,
    updated_by: userId,
    updated_at: knex.raw('SYSDATETIME()'),
  };

  if (existing) {
    await knex('cems_wpms_measurement_points').where({ id: existing.id }).update(pointPayload);
    return Number(existing.id);
  }

  const [inserted] = await knex('cems_wpms_measurement_points')
    .insert({
      request_id: requestId,
      point_code: station.stationId,
      ...pointPayload,
      created_by: userId,
    })
    .returning('id');

  return Number(inserted.id);
}

async function upsertConnectedMeasurementPoint(
  knex: Knex,
  station: ParameterValueMockStation,
  payload: {
    requestId: number;
    measurementPointId: number;
    userId: number;
    factoryId: string;
    factoryName: string;
    factoryRegistrationNo: string;
  },
): Promise<void> {
  const existing = await knex('cems_wpms_connected_measurement_points')
    .whereNull('deleted_at')
    .where({ point_code: station.stationId })
    .first('id');

  const connectedPayload = {
    source_request_id: payload.requestId,
    source_measurement_point_id: payload.measurementPointId,
    factory_id: payload.factoryId,
    factory_name: payload.factoryName,
    factory_registration_no: payload.factoryRegistrationNo,
    system_type: station.systemType,
    point_name: station.pointName,
    point_type: station.pointType,
    parameters_json: JSON.stringify(station.parameters.map((parameter) => parameter.label)),
    connected_at: knex.raw('SYSDATETIME()'),
    updated_by: payload.userId,
    updated_at: knex.raw('SYSDATETIME()'),
  };

  if (existing) {
    await knex('cems_wpms_connected_measurement_points')
      .where({ id: existing.id })
      .update(connectedPayload);
    return;
  }

  await knex('cems_wpms_connected_measurement_points').insert({
    point_code: station.stationId,
    ...connectedPayload,
    created_by: payload.userId,
  });
}

async function insertStatusHistory(
  knex: Knex,
  requestId: number,
  userId: number,
  stationId: string,
): Promise<void> {
  const existing = await knex('cems_wpms_request_status_history')
    .where({ request_id: requestId, status: 'CONNECTED' })
    .first('id');
  if (existing) return;

  await knex('cems_wpms_request_status_history').insert({
    request_id: requestId,
    status: 'CONNECTED',
    note: `Demo station access for ${stationId} parameter values API`,
    changed_by: userId,
  });
}

async function seedParameterValueTables(
  parameterDb: Knex,
  stations: ParameterValueMockStation[],
): Promise<void> {
  const schemaName = parameterSchemaName();
  await ensureSchema(parameterDb, schemaName);

  for (const station of stations) {
    for (const interval of MOCK_INTERVALS) {
      const tableName = `${station.stationId}_data_${interval}`;
      await ensureParameterTable(parameterDb, schemaName, tableName, station);
      await replaceRows(parameterDb, schemaName, tableName, station);
    }
  }
}

async function resolveMockStations(parameterDb: Knex): Promise<ParameterValueMockStation[]> {
  const schemaName = parameterSchemaName();

  return Promise.all(
    PARAMETER_VALUE_MOCK_STATIONS.map(async (station) => {
      const discoveredParameters = await discoverExistingParameters(
        parameterDb,
        schemaName,
        station,
      );
      if (discoveredParameters.length === 0) return station;

      return {
        ...station,
        parameters: discoveredParameters,
      };
    }),
  );
}

async function discoverExistingParameters(
  parameterDb: Knex,
  schemaName: string,
  station: ParameterValueMockStation,
): Promise<ParameterValueMockParameter[]> {
  const templateTableNames = templateTableNamesForStation(station.stationId);

  for (const tableName of templateTableNames) {
    const exists = await parameterDb.schema.withSchema(schemaName).hasTable(tableName);
    if (!exists) continue;

    const rows = await parameterDb('sys.tables as t')
      .join('sys.schemas as s', 't.schema_id', 's.schema_id')
      .join('sys.columns as c', 't.object_id', 'c.object_id')
      .where('s.name', schemaName)
      .where('t.name', tableName)
      .select<{ column_name: string }[]>({ column_name: 'c.name' })
      .orderBy('c.column_id', 'asc');

    const parameters = toParametersFromColumnNames(
      station,
      rows.map((row) => row.column_name),
    );
    if (parameters.length > 0) return parameters;
  }

  return [];
}

function templateTableNamesForStation(stationId: string): string[] {
  const direct = `${stationId}_data_${TEMPLATE_TABLE_INTERVAL}`;
  if (stationId === 'S00001') return [direct, `S0001_data_${TEMPLATE_TABLE_INTERVAL}`];
  return [direct];
}

function toParametersFromColumnNames(
  station: ParameterValueMockStation,
  columnNames: string[],
): ParameterValueMockParameter[] {
  const knownParameters = new Map(
    station.parameters.map((parameter) => [parameter.columnPrefix, parameter]),
  );
  const valuePrefixes = columnNames
    .map((columnName) => columnName.toLowerCase().match(/^(.+)_value$/)?.[1])
    .filter((prefix): prefix is string => Boolean(prefix));

  return [...new Set(valuePrefixes)].map((columnPrefix, index) => {
    const known = knownParameters.get(columnPrefix);
    if (known) return known;

    return {
      label: toParameterLabel(columnPrefix),
      columnPrefix,
      unit: '',
      baseValue: 20 + index,
      step: 0.5 + (index % 5) * 0.1,
    };
  });
}

function buildPastedSchemaMockParameters(): ParameterValueMockParameter[] {
  return PASTED_PARAMETER_COLUMN_PREFIXES.flatMap((columnPrefix, index) => {
    if (columnPrefix === 'co2') {
      return [
        {
          label: 'CO2 (%)',
          columnPrefix: 'co2_percent',
          unit: '%',
          baseValue: 10,
          step: 0.08,
        },
        {
          label: 'CO2 (ppm)',
          columnPrefix: 'co2_ppm',
          unit: 'ppm',
          baseValue: 520,
          step: 3,
        },
      ];
    }

    return [
      {
        label: toParameterLabel(columnPrefix),
        columnPrefix,
        unit: unitForColumnPrefix(columnPrefix),
        baseValue: 20 + index,
        step: 0.25 + (index % 7) * 0.05,
      },
    ];
  });
}

function ensureMinimumMockParameters(
  station: ParameterValueMockStation,
): ParameterValueMockStation {
  if (station.parameters.length >= MIN_MOCK_PARAMETER_COUNT) return station;

  const existingPrefixes = new Set(station.parameters.map((parameter) => parameter.columnPrefix));
  const parameters = [...station.parameters];

  for (let index = 1; parameters.length < MIN_MOCK_PARAMETER_COUNT; index += 1) {
    const columnPrefix = `param${String(index).padStart(3, '0')}`;
    if (existingPrefixes.has(columnPrefix)) continue;

    existingPrefixes.add(columnPrefix);
    parameters.push({
      label: `PARAM${String(index).padStart(3, '0')}`,
      columnPrefix,
      unit: '',
      baseValue: 20 + index,
      step: 0.25 + (index % 7) * 0.05,
    });
  }

  return {
    ...station,
    parameters,
  };
}

function toParameterLabel(columnPrefix: string): string {
  const knownLabels = new Map<string, string>([
    ['co', 'CO (ppm)'],
    ['nox', 'NOx (ppm)'],
    ['so2', 'SO2 (ppm)'],
    ['o2', 'O2 (%)'],
    ['co2', 'CO2 (ppm)'],
    ['co2ppm', 'CO2 (ppm)'],
    ['co2_ppm', 'CO2 (ppm)'],
    ['co2percent', 'CO2 (%)'],
    ['co2_percent', 'CO2 (%)'],
    ['temp', 'Temp. (°C)'],
    ['flow', 'Flow (m3/hr)'],
    ['pm', 'PM (mg/m3)'],
    ['bod', 'BOD (mg/l)'],
    ['cod', 'COD (mg/l)'],
    ['ph', 'pH'],
    ['tss', 'TSS (mg/l)'],
  ]);

  return knownLabels.get(columnPrefix) ?? columnPrefix.toUpperCase();
}

function unitForColumnPrefix(columnPrefix: string): string {
  const knownUnits = new Map<string, string>([
    ['co2', 'ppm'],
    ['co', 'ppm'],
    ['nox', 'ppm'],
    ['no', 'ppm'],
    ['no2', 'ppm'],
    ['so2', 'ppm'],
    ['sox', 'ppm'],
    ['o2', '%'],
    ['o3', 'ppm'],
    ['h2s', 'ppm'],
    ['hcl', 'ppm'],
    ['nh3', 'ppm'],
    ['temp', '°C'],
    ['flow', 'm3/hr'],
    ['flow2', 'm3/hr'],
    ['pressure', 'bar'],
    ['pressure_instack', 'bar'],
    ['bod', 'mg/l'],
    ['cod', 'mg/l'],
    ['cod2', 'mg/l'],
    ['tss', 'mg/l'],
    ['tds', 'mg/l'],
    ['ph', ''],
    ['pm1_0', 'µg/m3'],
    ['pm2_5', 'µg/m3'],
    ['pm10', 'µg/m3'],
    ['pm100', 'µg/m3'],
    ['particulate', 'mg/m3'],
    ['tsp', 'mg/m3'],
    ['dust', 'mg/m3'],
    ['opacity', '%'],
    ['moisture', '%'],
    ['rh', '%'],
    ['rain', 'mm'],
    ['noise', 'dB'],
    ['wd', 'degree'],
    ['ws', 'm/s'],
  ]);

  return knownUnits.get(columnPrefix) ?? '';
}

async function ensureSchema(parameterDb: Knex, schemaName: string): Promise<void> {
  await parameterDb.raw(
    `
    IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = ?)
    BEGIN
      EXEC('CREATE SCHEMA ${quoteIdentifier(schemaName)}')
    END
  `,
    [schemaName],
  );
}

async function ensureParameterTable(
  parameterDb: Knex,
  schemaName: string,
  tableName: string,
  station: ParameterValueMockStation,
): Promise<void> {
  const exists = await parameterDb.schema.withSchema(schemaName).hasTable(tableName);

  if (!exists) {
    await parameterDb.schema.withSchema(schemaName).createTable(tableName, (table) => {
      table.specificType('station_id', 'VARCHAR(64) NOT NULL');
      table.specificType('cdate', 'VARCHAR(10) NOT NULL');
      table.specificType('ctime', 'VARCHAR(8) NOT NULL');
      table.specificType('udate', 'VARCHAR(10) NULL');
      table.specificType('utime', 'VARCHAR(8) NULL');
      table.integer('data_completeness_percent').nullable();

      for (const parameter of station.parameters) {
        table.decimal(`${parameter.columnPrefix}_value`, 18, 4).nullable();
        table.specificType(`${parameter.columnPrefix}_units`, 'NVARCHAR(32) NULL');
        table.specificType(`${parameter.columnPrefix}_status`, 'NVARCHAR(64) NULL');
      }
    });
    return;
  }

  await ensureColumns(parameterDb, schemaName, tableName, station);
}

async function ensureColumns(
  parameterDb: Knex,
  schemaName: string,
  tableName: string,
  station: ParameterValueMockStation,
): Promise<void> {
  const baseColumns = [
    ['station_id', 'VARCHAR(64) NULL'],
    ['cdate', 'VARCHAR(10) NULL'],
    ['ctime', 'VARCHAR(8) NULL'],
    ['udate', 'VARCHAR(10) NULL'],
    ['utime', 'VARCHAR(8) NULL'],
    ['data_completeness_percent', 'INT NULL'],
  ] as const;

  for (const [columnName, columnType] of baseColumns) {
    await addColumnIfMissing(parameterDb, schemaName, tableName, columnName, columnType);
  }

  for (const parameter of station.parameters) {
    await addColumnIfMissing(
      parameterDb,
      schemaName,
      tableName,
      `${parameter.columnPrefix}_value`,
      'DECIMAL(18, 4) NULL',
    );
    await addColumnIfMissing(
      parameterDb,
      schemaName,
      tableName,
      `${parameter.columnPrefix}_units`,
      'NVARCHAR(32) NULL',
    );
    await addColumnIfMissing(
      parameterDb,
      schemaName,
      tableName,
      `${parameter.columnPrefix}_status`,
      'NVARCHAR(64) NULL',
    );
  }
}

async function addColumnIfMissing(
  parameterDb: Knex,
  schemaName: string,
  tableName: string,
  columnName: string,
  columnType: string,
): Promise<void> {
  const hasColumn = await parameterDb.schema
    .withSchema(schemaName)
    .hasColumn(tableName, columnName);
  if (hasColumn) return;

  await parameterDb.raw(
    `ALTER TABLE ${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)}
     ADD ${quoteIdentifier(columnName)} ${columnType}`,
  );
}

async function replaceRows(
  parameterDb: Knex,
  schemaName: string,
  tableName: string,
  station: ParameterValueMockStation,
): Promise<void> {
  await parameterDb
    .withSchema(schemaName)
    .from(tableName)
    .where('station_id', station.stationId)
    .whereIn('cdate', MOCK_DATES)
    .del();

  for (const date of MOCK_DATES) {
    await parameterDb
      .withSchema(schemaName)
      .from(tableName)
      .insert(buildParameterValueMockRows(station, date));
  }
}

function createParameterSourceKnex(primaryKnex: Knex): Knex {
  const primaryConnection = primaryKnex.client.config.connection as Record<string, unknown>;

  return createKnex({
    client: 'mssql',
    connection: {
      server: process.env.PARAMETER_DB_HOST ?? String(primaryConnection.server ?? 'localhost'),
      port: Number(process.env.PARAMETER_DB_PORT ?? primaryConnection.port ?? 1433),
      user: process.env.PARAMETER_DB_USER ?? String(primaryConnection.user ?? 'sa'),
      password: process.env.PARAMETER_DB_PASSWORD ?? String(primaryConnection.password ?? ''),
      database: process.env.PARAMETER_DB_NAME ?? String(primaryConnection.database ?? 'POMS'),
      options: {
        encrypt: process.env.PARAMETER_DB_ENCRYPT
          ? process.env.PARAMETER_DB_ENCRYPT === 'true'
          : Boolean((primaryConnection.options as Record<string, unknown> | undefined)?.encrypt),
        trustServerCertificate: process.env.PARAMETER_DB_TRUST_SERVER_CERTIFICATE
          ? process.env.PARAMETER_DB_TRUST_SERVER_CERTIFICATE !== 'false'
          : (((primaryConnection.options as Record<string, unknown> | undefined)
              ?.trustServerCertificate as boolean | undefined) ?? true),
      },
    },
    pool: {
      min: 0,
      max: 2,
    },
  });
}

function parameterSchemaName(): string {
  const schemaName = process.env.PARAMETER_DB_SCHEMA ?? 'dbo';
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schemaName)) {
    throw new Error('PARAMETER_DB_SCHEMA must be a safe SQL identifier');
  }

  return schemaName;
}

function buildMockValue(
  parameter: ParameterValueMockParameter,
  hour: number,
  parameterIndex: number,
): number {
  return Number((parameter.baseValue + hour * parameter.step + parameterIndex * 0.25).toFixed(2));
}

function buildMockStatus(hour: number, parameterIndex: number): ParameterValueMockStatus {
  const slot = (hour + parameterIndex) % 24;
  if (slot < 19) return 'Normal';
  if (slot < 22) return 'Maintenance';
  return 'Shut Down';
}

function quoteIdentifier(value: string): string {
  return `[${value.replace(/]/g, ']]')}]`;
}
