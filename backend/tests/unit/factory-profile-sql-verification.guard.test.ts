import { describe, expect, it } from '@jest/globals';
import {
  assertTestDatabaseIdentity,
  buildTestDatabaseConfig,
  TEST_DATABASE,
  TEST_PURPOSE,
} from '../../scripts/factory-profile-sql-verification';

describe('SQL verification target guard', () => {
  const identity = {
    databaseName: 'poms_factory_profile_test',
    purpose: 'factory-profile-integration-synthetic-only',
  };

  it('accepts only the dedicated database with its provisioning marker', () => {
    expect(TEST_DATABASE).toBe(identity.databaseName);
    expect(TEST_PURPOSE).toBe(identity.purpose);
    expect(() => assertTestDatabaseIdentity(identity)).not.toThrow();
  });

  it.each([
    { ...identity, databaseName: 'poms' },
    { ...identity, databaseName: 'master' },
    { ...identity, databaseName: 'poms_factory_profile_test_copy' },
    { ...identity, purpose: null },
    { ...identity, purpose: 'production' },
    undefined,
  ])('refuses an unapproved database identity %j', (value) => {
    expect(() => assertTestDatabaseIdentity(value)).toThrow(
      'Dedicated synthetic test database required',
    );
  });

  it('does not fall back to application database credentials', () => {
    expect(() =>
      buildTestDatabaseConfig({
        DB_HOST: 'production.invalid',
        DB_NAME: 'poms',
        DB_USER: 'example',
        DB_PASSWORD: 'example',
      }),
    ).toThrow('Explicit POMS_SQL_TEST settings required');
  });

  const settings = {
    POMS_SQL_TEST_HOST: 'fixture.invalid',
    POMS_SQL_TEST_DATABASE: 'poms_factory_profile_test',
    POMS_SQL_TEST_USER: 'fixture',
    POMS_SQL_TEST_PASSWORD: 'fixture-password',
    POMS_SQL_TEST_PORT: '1433',
    POMS_SQL_TEST_ENCRYPT: 'false',
    POMS_SQL_TEST_TRUST_SERVER_CERTIFICATE: 'true',
  };

  it('builds a bounded connection pool for only the exact test database', () => {
    const config = buildTestDatabaseConfig(settings);
    expect(config.connection).toMatchObject({
      server: 'fixture.invalid',
      database: TEST_DATABASE,
      port: 1433,
    });
    expect(config.pool).toMatchObject({ min: 0, max: 3 });
  });

  it.each([
    { POMS_SQL_TEST_DATABASE: 'poms' },
    { POMS_SQL_TEST_PORT: '1433;SELECT 1' },
    { POMS_SQL_TEST_PORT: '65536' },
    { POMS_SQL_TEST_HOST: '' },
    { POMS_SQL_TEST_PASSWORD: '' },
    { POMS_SQL_TEST_ENCRYPT: 'yes' },
  ])('rejects invalid explicit settings %j', (patch) => {
    expect(() => buildTestDatabaseConfig({ ...settings, ...patch })).toThrow();
  });
});
