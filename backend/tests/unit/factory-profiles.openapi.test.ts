import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject => value as JsonObject;
const schemas = object(object(pomsOpenApiDocument.components).schemas);
const operation = (path: string, method: string): JsonObject =>
  object(object(object(pomsOpenApiDocument.paths)[path])[method]);
const description = (value: JsonObject): string => String(value.description ?? '');

describe('canonical factory profile public contract', () => {
  it('publishes optional nullable eiaOther in factory general responses without requiring new client payload fields', () => {
    const general = object(schemas.ConnectionFactoryGeneral);
    expect(object(general.properties).eiaOther).toMatchObject({
      type: 'string',
      nullable: true,
      maxLength: 500,
    });
    expect(general.required).not.toContain('eiaOther');
    expect(object(object(schemas.OperatorFactoryTableRow).properties).eiaOther).toMatchObject({
      type: 'string',
      nullable: true,
    });
    const read = operation('/cems-wpms-requests/factories/{factoryId}/general', 'get');
    const response = object(object(read.responses)['200']);
    expect(object(object(object(response.content)['application/json']).schema)).toEqual({
      $ref: '#/components/schemas/ConnectionFactoryGeneralResponse',
    });
    for (const name of [
      'PomsFactoryEditableProfileRequest',
      'PomsFactoryEditableMeasurementPointsRequest',
    ]) {
      expect(object(object(schemas[name]).properties)).not.toHaveProperty(
        'sourceFactoryProfileRevision',
      );
      expect(object(object(schemas[name]).properties)).not.toHaveProperty('factoryProfileId');
    }
  });

  it('separates the canonical general-profile timestamp from measurement-point versions', () => {
    const profile = object(schemas.PomsFactoryProfile);
    const point = object(schemas.PomsMeasurementPoint);
    expect(description(object(object(profile.properties).updatedAt))).toContain('ข้อมูลทั่วไป');
    expect(description(object(object(profile.properties).updatedAt))).toContain('canonical');
    expect(description(object(object(point.properties).updatedAt))).toContain('จุดตรวจวัด');
    const review = operation('/poms-factories/edit-requests/{id}/review', 'post');
    expect(description(review)).toContain('revision');
    expect(description(review)).toContain('ไม่ต้องส่ง');
    expect(description(object(object(review.responses)['409']))).toContain('canonical');
  });

  it('documents current point values, explicit clears and inactive 404 on parameter-form reads', () => {
    for (const path of [
      '/connected-measurement-points/{stationId}/parameter-form',
      '/connected-measurement-points/{stationId}/{buddhistYear}/parameter-form',
    ]) {
      const read = operation(path, 'get');
      expect(description(read)).toContain('active');
      for (const field of [
        'parameters',
        'details',
        'documentsAndImages',
        'measurementInstruments',
        'null',
      ])
        expect(description(read)).toContain(field);
      expect(description(read)).toContain('404');
      expect(object(read.responses)).toHaveProperty('404');
    }
  });

  it('documents connection initialization and protection from replaying old factory snapshots', () => {
    for (const path of [
      '/cems-wpms-requests/direct-connections',
      '/cems-wpms-requests/{id}/confirm-connection',
      '/cems-wpms-requests/{id}/verify-connection',
    ]) {
      const write = operation(path, 'post');
      expect(description(write)).toContain('ครั้งแรก');
      expect(description(write)).toContain('snapshot');
      const conflict = object(object(write.responses)['409']);
      expect(description(conflict)).toContain('FACTORY_PROFILE_CONFLICT');
      expect(description(conflict)).toContain('error.details.reason');
    }
  });

  it('documents canonical linked-form EIA validation without restricting legacy or blank drafts', () => {
    const form = object(schemas.MonitoringPointFormRequest);
    const factory = object(object(form.properties).factory);
    const eia = object(object(factory.properties).eiaInfo);
    expect(description(eia)).toContain('canonical');
    expect(description(eia)).toContain('BAD_REQUEST');
    expect(description(eia)).toContain('null');
    expect(description(eia)).toContain('ไม่ส่ง');
    expect(eia).not.toHaveProperty('enum');
  });

  it('documents the canonical linked-form registration guard while retaining optional draft fields', () => {
    const form = object(schemas.MonitoringPointFormRequest);
    const factory = object(object(form.properties).factory);
    const registration = object(object(factory.properties).factoryRegistrationNoNew);
    expect(description(registration)).toContain('canonical');
    expect(description(registration)).toContain('409 CONFLICT');
    expect(description(registration)).toContain('factory.factoryRegistrationNoNew');
    expect(description(registration)).toContain('ไม่ส่ง');
    expect(registration.nullable).toBe(true);
    expect(factory.required ?? []).not.toContain('factoryRegistrationNoNew');
  });

  it('documents the bounded first-connection revision recovery through the existing status action', () => {
    const status = operation('/cems-wpms-requests/{id}/status', 'post');
    for (const text of [
      'canonical',
      'REQUEST_REVISION',
      'WAITING_CONNECTION',
      'CONNECTION_CONFIRMED',
      'WAITING_FACTORY_REVISION',
      'revision',
      'active',
    ]) {
      expect(description(status)).toContain(text);
    }
  });

  it('keeps registry-only and historical request reads distinct from current eligible/POMS profiles', () => {
    const general = description(
      operation('/cems-wpms-requests/factories/{factoryId}/general', 'get'),
    );
    expect(general).toContain('Fac60k');
    expect(general).toContain('เข้าข่าย');
    expect(general).toContain('POMS');
    expect(general).toContain('read-only');
    expect(description(operation('/cems-wpms-requests/{id}/form', 'get'))).toContain('snapshot');
  });
});
