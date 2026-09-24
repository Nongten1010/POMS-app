import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

type JsonObject = Record<string, unknown>;

function objectAt(value: unknown, ...keys: string[]): JsonObject {
  let current = value;
  for (const key of keys) {
    current = objectAt(current)[key];
  }
  if (!current || typeof current !== 'object' || Array.isArray(current)) {
    throw new Error(`Expected an object at ${keys.join('.') || 'root'}`);
  }
  return current as JsonObject;
}

const schemas = objectAt(pomsOpenApiDocument, 'components', 'schemas');
const paths = objectAt(pomsOpenApiDocument, 'paths');
const operationFor = (path: string): JsonObject => objectAt(paths, path, 'get');
const responseFor = (path: string): JsonObject =>
  objectAt(operationFor(path), 'responses', '200', 'content', 'application/json');
const propertiesFor = (name: string): JsonObject => objectAt(schemas, name, 'properties');
const stationPath = '/connected-measurement-points/{stationId}';
const annualStationPath = `${stationPath}/{buddhistYear}`;
const responseSchema = (path: string): unknown => objectAt(responseFor(path), 'schema').$ref;

describe('home handoff OpenAPI contract', () => {
  it.each([
    ['/operator-factory-dashboard', 'HomeOperatorFactoryDashboardResponse'],
    ['/public/factory-map-points', 'HomePublicFactoryMapResponse'],
    [`${stationPath}/measurement-statistics`, 'HomeMeasurementStatisticsResponse'],
    [`${annualStationPath}/measurement-statistics`, 'HomeMeasurementStatisticsResponse'],
    [`${stationPath}/calendar-status`, 'HomeCalendarStatusResponse'],
    [`${annualStationPath}/calendar-status`, 'HomeCalendarStatusResponse'],
    [`${stationPath}/calendar-status/details`, 'HomeCalendarStatusDetailsResponse'],
    [`${annualStationPath}/calendar-status/details`, 'HomeCalendarStatusDetailsResponse'],
  ])('publishes the home response schema for %s', (path, schemaName) => {
    expect(responseSchema(path)).toBe(`#/components/schemas/${schemaName}`);
    expect(schemas[schemaName]).toBeDefined();
    expect(operationFor(path).description).toContain('ctime');
    expect(operationFor(path).description).toContain('cdate');
    expect(operationFor(path).description).toContain('utime');
    expect(operationFor(path).description).toContain('udate');
    expect(operationFor(path).description).toContain('Asia/Bangkok');
    expect(responseFor(path).example).toMatchObject({
      success: true,
      data: expect.anything(),
      meta: expect.anything(),
    });
  });

  it.each([stationPath, annualStationPath])('keeps endDate aligned for %s aliases', (prefix) => {
    for (const suffix of ['/calendar-status', '/calendar-status/details']) {
      const operation = operationFor(`${prefix}${suffix}`);
      const parameters = operation.parameters;
      if (!Array.isArray(parameters)) throw new Error('Expected query parameters');
      const endDate = objectAt(
        parameters.find((parameter: unknown) => objectAt(parameter).name === 'endDate'),
      );
      expect(endDate).toMatchObject({
        in: 'query',
        required: false,
        schema: { type: 'string', format: 'date' },
      });
      expect(endDate.description).toContain('ไม่เกินวันนี้');
      expect(endDate.description).toContain('400 VALIDATION_ERROR');
      expect(objectAt(operation, 'responses')['400']).toBeDefined();
      expect(operation['x-poms-permissions']).toEqual(['dashboard.stats:view']);
    }
    expect(operationFor(`${prefix}/measurement-statistics`).parameters).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'endDate' })]),
    );
  });

  it('separates point summaries, parameter summaries and no-expected-data states', () => {
    const summary = objectAt(schemas, 'HomeMeasurementSummary');
    expect(summary.required).toEqual([
      'exceededDays',
      'lowDataDays',
      'todayDataCompletenessPercent',
      'lateDataPercent',
    ]);
    expect(objectAt(summary, 'properties', 'exceededDays').description).toContain('จำนวนวันไม่ซ้ำ');
    expect(objectAt(summary, 'properties', 'lowDataDays').description).toContain('ต่อเนื่องล่าสุด');
    expect(objectAt(summary, 'properties', 'todayDataCompletenessPercent').nullable).toBe(true);
    expect(objectAt(summary, 'properties', 'lateDataPercent').nullable).toBe(true);
    const day = propertiesFor('HomeCalendarDay');
    expect(objectAt(day, 'dataCompletenessPercent').nullable).toBe(true);
    expect(day.dataCompletenessStatus).toMatchObject({
      nullable: true,
      enum: ['lowData', 'highData', null],
    });
    expect(objectAt(day, 'display', 'properties', 'backgroundStatus').nullable).toBe(true);
    expect(objectAt(schemas, 'HomeParameterSummary').required).toContain('parameterLabel');
    expect(objectAt(schemas, 'HomeParameterSummary').required).toContain('lateDataPercent');
    expect(
      objectAt(propertiesFor('HomeCalendarStatusResponse'), 'data', 'properties').summary,
    ).toEqual({
      $ref: '#/components/schemas/HomeMeasurementSummary',
    });
    expect(
      objectAt(propertiesFor('HomeMeasurementStatisticsResponse'), 'data', 'properties').summary,
    ).toEqual({
      $ref: '#/components/schemas/HomeMeasurementSummary',
    });
  });

  it('publishes lateData at value, day and border level with pollution precedence', () => {
    const valueStatus = objectAt(propertiesFor('HomeMeasurementValue'), 'status');
    expect(valueStatus.enum).toEqual(
      expect.arrayContaining(['lateData', 'warning', 'exceeded', 'noData']),
    );
    expect(valueStatus.description).toContain('exceeded > warning > lateData > normal');
    expect(objectAt(propertiesFor('HomeCalendarDay'), 'pollutionStatus').enum).toContain(
      'lateData',
    );
    expect(
      objectAt(propertiesFor('HomeCalendarDay'), 'display', 'properties', 'borderStatus').enum,
    ).toContain('lateData');
  });

  it('keeps integration and operator overview contracts separate from home additions', () => {
    expect(responseSchema('/integrations/lasthour/factories/{registrationNo}')).toBe(
      '#/components/schemas/IntegrationFactoryDashboardResponse',
    );
    expect(
      objectAt(propertiesFor('IntegrationFactoryDashboardRow'), 'measurementPoints', 'items').$ref,
    ).toBe('#/components/schemas/FactoryDashboardMeasurementPoint');
    expect(objectAt(propertiesFor('HomePublicFactoryRow'), 'measurementPoints', 'items').$ref).toBe(
      '#/components/schemas/HomeFactoryMeasurementPoint',
    );
    expect(responseSchema('/operator-factories')).toBe(
      '#/components/schemas/OperatorFactoryOverviewResponse',
    );
    expect(operationFor('/public/factory-map-points').security).toEqual([]);
    expect(operationFor('/operator-factory-dashboard')['x-poms-permissions']).toEqual([
      'dashboard:view',
    ]);
    expect(propertiesFor('HomePublicFactoryRow').isFavorite).toBeUndefined();
    expect(objectAt(schemas, 'HomeOperatorFactoryRow').required).toContain('isFavorite');
    expect(schemas.HomeFactoryMeasurementPoint).not.toBe(schemas.FactoryDashboardMeasurementPoint);
    expect(propertiesFor('FactoryDashboardMeasurementPoint').latestMeasurement).toBeUndefined();
  });

  it('requires the completed-hour popup and filters empty home factories', () => {
    expect(objectAt(schemas, 'HomeFactoryMeasurementPoint').required).toContain(
      'latestMeasurement',
    );
    expect(propertiesFor('HomeFactoryMeasurementPoint').latestMeasurement).toEqual({
      $ref: '#/components/schemas/HomeLatestMeasurement',
    });
    expect(objectAt(propertiesFor('HomePublicFactoryRow'), 'measurementPoints').minItems).toBe(1);
    expect(objectAt(propertiesFor('HomeLatestMeasurement'), 'values').additionalProperties).toEqual(
      {
        $ref: '#/components/schemas/HomeMeasurementValue',
      },
    );
    const example = responseFor('/public/factory-map-points').example;
    const factories = objectAt(example).data;
    if (!Array.isArray(factories)) throw new Error('Expected factory rows');
    const points = objectAt(factories[0]).measurementPoints;
    if (!Array.isArray(points)) throw new Error('Expected measurement points');
    expect(points[0]).toMatchObject({
      data: [],
      latestMeasurement: {
        date: '2026-09-23',
        time: '09:00:00',
        values: { 'CO (ppm)': { value: null, status: 'noData' } },
      },
    });
  });

  it('resolves every schema reference reachable from the home responses locally', () => {
    const visited = new Set<string>();
    function check(value: unknown): void {
      if (Array.isArray(value)) return value.forEach(check);
      if (!value || typeof value !== 'object') return;
      const entry = objectAt(value);
      if (entry.$ref) {
        if (typeof entry.$ref !== 'string') throw new Error('Expected a string schema reference');
        expect(entry.$ref).toMatch(/^#\/components\/schemas\//);
        const name = entry.$ref.split('/').at(-1) as string;
        expect(schemas[name]).toBeDefined();
        if (!visited.has(name)) {
          visited.add(name);
          check(schemas[name]);
        }
      }
      Object.values(entry).forEach(check);
    }
    Object.entries(schemas)
      .filter(([name]) => name.startsWith('Home'))
      .forEach(([, schema]) => check(schema));
  });
});
