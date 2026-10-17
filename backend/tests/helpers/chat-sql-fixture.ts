import { jest } from '@jest/globals';
import type { Knex } from 'knex';
import initSqlJs, { type SqlValue } from 'sql.js';

export type ChatFixtureRow = Record<string, unknown>;

export const chatFixtureActors = {
  operator: { id: 101, userType: 'operator', role: 'factory_operator' },
  coworker: { id: 102, userType: 'operator', role: 'factory_operator' },
  outsider: { id: 103, userType: 'operator', role: 'factory_operator' },
  officer: { id: 201, userType: 'officer', role: 'diw_central' },
  provinceOfficer: { id: 202, userType: 'officer', role: 'provincial_office' },
  custom: { id: 203, userType: 'officer', role: 'diw_central' },
  admin: { id: 204, userType: 'admin', role: 'admin' },
  citizen: { id: 301, userType: 'citizen', role: 'public_user' },
} as const;

export interface ChatSqlFixture {
  execute(sql: string, bindings?: unknown[]): void;
  close(): void;
}

/** Synthetic data also exercises the real current-authorization resolver on every HTTP request. */
export function chatFixtureTables(): Record<string, ChatFixtureRow[]> {
  const roles = [
    { id: 1, code: 'factory_operator', deleted_at: null },
    { id: 2, code: 'diw_central', deleted_at: null },
    { id: 3, code: 'provincial_office', deleted_at: null },
    { id: 4, code: 'admin', deleted_at: null },
    { id: 5, code: 'public_user', deleted_at: null },
  ];
  const permissions = [
    { id: 1, code: 'chat:view' },
    { id: 2, code: 'chat:ask' },
    { id: 3, code: 'chat:answer' },
    { id: 4, code: 'eligible_factories:view' },
  ];
  const actorRows = Object.entries(chatFixtureActors).map(([name, actor]) => ({
    id: actor.id,
    external_id: `synthetic-${actor.id}`,
    identity_provider: 'local',
    user_type: actor.userType,
    username: name,
    prename_th: null,
    first_name: `ผู้ใช้สมมติ ${name}`,
    last_name: 'ทดสอบ',
    email: null,
    phone: null,
    password_hash: null,
    is_active: 1,
    deleted_at: null,
    permission_mode: name === 'custom' ? 'custom' : 'role_default',
  }));
  return {
    users: actorRows,
    roles,
    permissions,
    user_roles: Object.values(chatFixtureActors).map((actor) => ({
      user_id: actor.id,
      role_id: roles.find((role) => role.code === actor.role)?.id,
    })),
    role_permissions: roles.flatMap((role) => {
      const granted =
        role.code === 'factory_operator'
          ? [1, 2, 4]
          : role.code === 'public_user'
            ? [1, 2]
            : [1, 2, 3, 4];
      return granted.map((permissionId) => ({
        role_id: role.id,
        permission_id: permissionId,
        scope:
          permissionId !== 4
            ? null
            : role.code === 'factory_operator'
              ? 'OWN_FACTORY'
              : role.code === 'provincial_office'
                ? 'IN_PROVINCE'
                : 'ALL',
      }));
    }),
    user_permissions: [1, 3, 4].map((permissionId) => ({
      user_id: 203,
      permission_id: permissionId,
      effect: 'allow',
      scope: permissionId === 4 ? 'IN_PROVINCE' : null,
      province_id: permissionId === 4 ? '2100' : null,
      region_name: null,
      estate_code: null,
    })),
    provinces: [
      { id: '2100', name_th: 'ระยอง', region: 'ภาคตะวันออก' },
      { id: '1000', name_th: 'กรุงเทพมหานคร', region: 'ภาคกลาง' },
    ],
    industrial_estates: [{ id: 1, code: 'IE-TEST', name_th: 'นิคมสมมติ' }],
    organizations: [],
    officer_profiles: [
      {
        user_id: 201,
        province_id: '1000',
        department_id: '3010000',
        department_name_th: 'กรมโรงงานอุตสาหกรรม',
      },
      {
        user_id: 202,
        province_id: '2100',
        department_id: 'PROVINCE',
        department_name_th: 'สำนักงานอุตสาหกรรมจังหวัดระยอง',
      },
      {
        user_id: 203,
        province_id: '1000',
        department_id: '3010000',
        department_name_th: 'กรมโรงงานอุตสาหกรรม',
      },
      {
        user_id: 204,
        province_id: '1000',
        department_id: '3010000',
        department_name_th: 'กรมโรงงานอุตสาหกรรม',
      },
    ],
    factories: [10, 20, 30, 40].map((id) => ({
      id,
      fid: `FIXTURE-${id}`,
      code: `REG-${id}`,
      juristic_id: id,
      name: `โรงงานสมมติ ${id}`,
      province_id: id === 20 ? '1000' : '2100',
      is_active: 1,
      deleted_at: null,
    })),
    user_juristics: [],
    user_factory_access: [
      { user_id: 101, factory_id: 10, revoked_at: null },
      { user_id: 101, factory_id: 30, revoked_at: null },
      { user_id: 101, factory_id: 40, revoked_at: null },
      { user_id: 102, factory_id: 10, revoked_at: null },
      { user_id: 103, factory_id: 20, revoked_at: null },
    ],
    eligible_factories: [10, 20, 30, 40].map((id) => ({
      id,
      source_factory_id: `FIXTURE-${id}`,
      factory_registration_no_new: `REG-${id}`,
      factory_registration_no_old: `OLD-${id}`,
      factory_name: `โรงงานสมมติ ${id}`,
      province_name: id === 20 ? 'กรุงเทพมหานคร' : 'ระยอง',
      industrial_estate_name: id === 10 ? 'นิคมสมมติ' : null,
      factory_type_sequence: '00088',
      monitoring_point_form_id: id === 30 ? null : id * 10,
      deleted_at: id === 40 ? '2026-01-01T00:00:00.000Z' : null,
    })),
    factory_monitoring_point_forms: [10, 20, 40].map((id) => ({
      id: id * 10,
      deleted_at: id === 40 ? '2026-01-01T00:00:00.000Z' : null,
    })),
    factory_monitoring_points: [10, 20, 40].map((id) => ({
      id: id * 100,
      form_id: id * 10,
      system_type: 'CEMS',
      point_code: `E${id}`,
      point_name: `จุดเข้าข่าย ${id}`,
      deleted_at: null,
    })),
    cems_wpms_connected_measurement_points: [
      {
        id: 2000,
        eligible_factory_id: 10,
        factory_id: 'FIXTURE-10',
        factory_registration_no: 'REG-10',
        system_type: 'CEMS',
        point_code: 'C10',
        point_name: 'จุดเชื่อมต่อสมมติ',
        deleted_at: null,
      },
    ],
  };
}

export const chatFixtureSchemas: Record<string, string[]> = {
  chat_ticket_sequences: ['year', 'last_number'],
  chat_tickets: [
    'id',
    'ticket_no',
    'eligible_factory_id',
    'eligible_point_id',
    'connected_point_id',
    'topic_code',
    'topic_label',
    'factory_name',
    'factory_registration_no',
    'province_name',
    'region_name',
    'point_system_type',
    'point_code',
    'point_name',
    'status',
    'opened_by',
    'opened_by_name',
    'opened_by_role_code',
    'opened_by_role_label',
    'opened_at',
    'closed_by',
    'closed_by_name',
    'closed_by_role_code',
    'closed_by_role_label',
    'closed_at',
    'last_message_at',
    'creation_key',
    'creation_hash',
  ],
  chat_messages: [
    'id',
    'ticket_id',
    'sender_id',
    'sender_name',
    'sender_role_code',
    'sender_role_label',
    'body',
    'created_at',
    'idempotency_key',
    'request_hash',
  ],
  chat_ticket_events: [
    'id',
    'ticket_id',
    'event_type',
    'actor_id',
    'actor_name',
    'actor_role_code',
    'actor_role_label',
    'created_at',
  ],
  organizations: ['id', 'external_id', 'level', 'name_th'],
  officer_profiles: [
    'user_id',
    'pos_no',
    'pertype_id',
    'pertype',
    'position_type_id',
    'position_type_th',
    'line_id',
    'line_name_th',
    'level_id',
    'level_name_th',
    'mposition_id',
    'mposition',
    'organize_id',
    'organize_name_th',
    'division_name_th',
    'department_id',
    'department_name_th',
    'ministry_id',
    'province_id',
    'estate_code',
    'per_status',
    'per_status_name',
    'regional_access_json',
  ],
  user_juristics: ['user_id', 'juristic_id', 'revoked_at'],
  user_factory_access: ['user_id', 'factory_id', 'revoked_at'],
};

function scalar(value: unknown): SqlValue {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number' || typeof value === 'string' || value instanceof Uint8Array)
    return value;
  throw new TypeError('Chat fixture only supports scalar database values');
}

function quote(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Execute production Knex queries at the database boundary using synthetic SQL.js data.
 * SQL Server lock hints are ignored: this fixture verifies behavior and rollback,
 * never SQL Server concurrency or dialect compatibility.
 */
export async function createChatSqlFixture(
  db: Knex,
  extraTables: Record<string, ChatFixtureRow[]> = {},
  extraSchemas: Record<string, string[]> = {},
): Promise<ChatSqlFixture> {
  const SQL = await initSqlJs({ locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm') });
  const sqlite = new SQL.Database();
  sqlite.create_function('SYSUTCDATETIME', () => new Date().toISOString());
  sqlite.create_function('SYSDATETIME', () => new Date().toISOString());
  sqlite.create_function('GETDATE', () => new Date().toISOString());
  sqlite.create_function('LEN', (value: SqlValue) => String(value ?? '').length);
  const tables = { ...chatFixtureTables(), ...extraTables };
  const schemas = { ...chatFixtureSchemas, ...extraSchemas };
  try {
    for (const name of new Set([...Object.keys(tables), ...Object.keys(schemas)])) {
      const rows = tables[name] ?? [];
      const columns = [...new Set([...(schemas[name] ?? []), ...rows.flatMap(Object.keys)])];
      if (!columns.length) throw new Error(`Chat fixture table ${name} requires a schema`);
      const definitions = columns.map((column) => {
        const values = rows.map((row) => row[column]).filter((value) => value != null);
        const numeric =
          ['id', 'year', 'last_number', 'opened_by', 'closed_by'].includes(column) ||
          column.endsWith('_id') ||
          (values.length > 0 &&
            values.every((value) => typeof value === 'number' || typeof value === 'boolean'));
        return `${quote(column)} ${numeric ? 'INTEGER' : 'TEXT'}${column === 'id' ? ' PRIMARY KEY' : ''}`;
      });
      sqlite.run(`CREATE TABLE ${quote(name)} (${definitions.join(', ')})`);
      for (const row of rows) {
        sqlite.run(
          `INSERT INTO ${quote(name)} (${columns.map(quote).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
          columns.map((column) => scalar(row[column])),
        );
      }
    }
    sqlite.run('CREATE UNIQUE INDEX chat_sequence_year ON chat_ticket_sequences(year)');
    sqlite.run('CREATE UNIQUE INDEX chat_ticket_number ON chat_tickets(ticket_no)');
    sqlite.run(
      'CREATE UNIQUE INDEX chat_ticket_creation_key ON chat_tickets(opened_by,creation_key)',
    );
    sqlite.run(
      'CREATE UNIQUE INDEX chat_message_key ON chat_messages(sender_id,ticket_id,idempotency_key) WHERE idempotency_key IS NOT NULL',
    );
    sqlite.run('CREATE UNIQUE INDEX chat_event_kind ON chat_ticket_events(ticket_id,event_type)');
    sqlite.run('CREATE VIEW current_eligible_factories AS SELECT * FROM eligible_factories');
    sqlite.run(
      'CREATE VIEW current_connected_measurement_points AS SELECT * FROM cems_wpms_connected_measurement_points',
    );
  } catch (error) {
    sqlite.close();
    throw error;
  }

  const runner = jest.spyOn(db.client, 'runner').mockImplementation((builder: unknown) => ({
    run: async () => {
      const compiled = (builder as Knex.QueryBuilder).toSQL();
      const bindings = compiled.bindings.map(scalar);
      let sql = compiled.sql.replace(
        /\s+with\s*\((?:UPDLOCK|HOLDLOCK|ROWLOCK|XLOCK)(?:\s*,\s*(?:UPDLOCK|HOLDLOCK|ROWLOCK|XLOCK))*\)/gi,
        '',
      );
      sql = sql.replace(
        /RIGHT\(REPLICATE\('0', 5\) \+ LTRIM\(RTRIM\(COALESCE\(CONVERT\(varchar\(64\), ([^)]+)\), ''\)\)\), 5\)/gi,
        "substr('00000' || trim(COALESCE(CAST($1 AS TEXT), '')), -5)",
      );
      const guarded =
        /^\s*IF NOT EXISTS\s*\(([\s\S]+)\)\s*BEGIN\s*(INSERT\s+INTO[\s\S]+)\s+VALUES\s*\(([\s\S]+)\);?\s*END;?\s*$/i.exec(
          sql,
        );
      if (guarded) {
        const count = (guarded[1].match(/\?/g) ?? []).length;
        bindings.push(...bindings.splice(0, count));
        sql = `${guarded[2]} SELECT ${guarded[3]} WHERE NOT EXISTS (${guarded[1]})`;
      }
      const top = /^select\s+(distinct\s+)?top\s*\(\?\)\s+/i.exec(sql);
      if (top) {
        sql = sql.replace(top[0], `select ${top[1] ?? ''}`) + ' LIMIT ?';
        bindings.push(bindings.shift() ?? null);
      }
      if (/offset \? rows fetch next \? rows only$/i.test(sql)) {
        sql = sql.replace(/offset \? rows fetch next \? rows only$/i, 'LIMIT ? OFFSET ?');
        const [offset, limit] = bindings.splice(-2);
        bindings.push(limit, offset);
      }
      sql = sql.replace(/;\s*select\s+@@rowcount\s*$/i, '');
      const output =
        /\s+output\s+((?:inserted|deleted)\.(?:\[[^\]]+\]|\*)(?:\s*,\s*(?:inserted|deleted)\.(?:\[[^\]]+\]|\*))*)/i.exec(
          sql,
        );
      if (output)
        sql =
          sql.replace(output[0], '') +
          ` RETURNING ${output[1].replace(/(?:inserted|deleted)\./gi, '')}`;
      const statement = sqlite.prepare(sql, bindings);
      const rows: Record<string, SqlValue>[] = [];
      try {
        while (statement.step()) rows.push(statement.getAsObject());
      } finally {
        statement.free();
      }
      if (compiled.method === 'first') return rows[0];
      if (compiled.method === 'update' || compiled.method === 'del')
        return output ? rows : sqlite.getRowsModified();
      return rows;
    },
  }));
  const context = (db as Knex & { context: { transaction: typeof db.transaction } }).context;
  const runTransaction = async (callback: unknown): Promise<unknown> => {
    if (typeof callback !== 'function')
      throw new TypeError('Chat fixture requires callback transactions');
    const previousTransactionState = Object.getOwnPropertyDescriptor(db, 'isTransaction');
    Object.defineProperty(db, 'isTransaction', { value: true, configurable: true });
    try {
      sqlite.run('BEGIN');
      try {
        const result: unknown = await callback(db as Knex.Transaction);
        sqlite.run('COMMIT');
        return result;
      } catch (error) {
        sqlite.run('ROLLBACK');
        throw error;
      }
    } finally {
      if (previousTransactionState) {
        Object.defineProperty(db, 'isTransaction', previousTransactionState);
      } else {
        Reflect.deleteProperty(db, 'isTransaction');
      }
    }
  };
  const transaction = jest
    .spyOn(context, 'transaction')
    .mockImplementation(runTransaction as typeof db.transaction);
  let closed = false;
  return {
    execute: (sql, bindings = []) => sqlite.run(sql, bindings.map(scalar)),
    close: () => {
      if (closed) return;
      runner.mockRestore();
      transaction.mockRestore();
      sqlite.close();
      closed = true;
    },
  };
}

export const CHAT_SQL_TEST_DATABASE = 'poms_chat_test';
export const CHAT_SQL_TEST_PURPOSE = 'chat-integration-synthetic-only';

/** No application environment fallback is allowed for a schema-writing verification run. */
export function buildChatSqlServerTestConfig(settings: NodeJS.ProcessEnv): Knex.Config {
  const host = settings.POMS_SQL_TEST_HOST;
  const user = settings.POMS_SQL_TEST_USER;
  const password = settings.POMS_SQL_TEST_PASSWORD;
  if (!host || !user || !password || settings.POMS_SQL_TEST_DATABASE !== CHAT_SQL_TEST_DATABASE) {
    throw new Error('Explicit POMS_SQL_TEST settings for poms_chat_test are required');
  }
  const port = settings.POMS_SQL_TEST_PORT ?? '1433';
  if (!/^[0-9]+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error('Invalid chat test SQL port');
  }
  for (const name of ['POMS_SQL_TEST_ENCRYPT', 'POMS_SQL_TEST_TRUST_SERVER_CERTIFICATE']) {
    const value = settings[name];
    if (value !== undefined && !['true', 'false'].includes(value)) {
      throw new Error('Invalid chat test SQL encryption setting');
    }
  }
  return {
    client: 'mssql',
    connection: {
      server: host,
      user,
      password,
      database: CHAT_SQL_TEST_DATABASE,
      port: Number(port),
      requestTimeout: 15_000,
      options: {
        encrypt: settings.POMS_SQL_TEST_ENCRYPT !== 'false',
        trustServerCertificate: settings.POMS_SQL_TEST_TRUST_SERVER_CERTIFICATE === 'true',
      },
    },
    pool: { min: 0, max: 4 },
    acquireConnectionTimeout: 15_000,
  };
}

export function assertChatSqlTestDatabaseIdentity(
  value: { databaseName?: unknown; purpose?: unknown } | undefined,
): void {
  if (value?.databaseName !== CHAT_SQL_TEST_DATABASE || value?.purpose !== CHAT_SQL_TEST_PURPOSE) {
    throw new Error('Dedicated synthetic chat test database required');
  }
}

/** Build only synthetic dependency tables; the real chat migration creates all chat tables. */
export async function createChatSqlServerFixtures(database: Knex): Promise<void> {
  await database.transaction(async (trx) => {
    const identity = await trx.raw(
      'SELECT DB_NAME() AS databaseName, CONVERT(NVARCHAR(128), value) AS purpose ' +
        "FROM sys.extended_properties WHERE class = 0 AND name = N'PomsTestPurpose'",
    );
    assertChatSqlTestDatabaseIdentity(identity[0]);
    const tableCount = await trx.raw(
      'SELECT COUNT(*) AS count FROM sys.tables WHERE is_ms_shipped = 0',
    );
    if (Number(tableCount[0]?.count) !== 0) {
      throw new Error(
        'Chat SQL verification requires a newly provisioned empty synthetic database',
      );
    }
    const tables = chatFixtureTables();
    const dependencies = Object.fromEntries(
      Object.entries(chatFixtureSchemas).filter(([name]) => !name.startsWith('chat_')),
    );
    for (const name of new Set([...Object.keys(tables), ...Object.keys(dependencies)])) {
      const rows = tables[name] ?? [];
      const columns = [...new Set([...(dependencies[name] ?? []), ...rows.flatMap(Object.keys)])];
      await trx.schema.createTable(name, (table) => {
        for (const column of columns) {
          const values = rows.map((row) => row[column]).filter((value) => value != null);
          const numeric =
            (column === 'id' && name !== 'provinces') ||
            (values.length > 0 &&
              values.every((value) => typeof value === 'number' || typeof value === 'boolean'));
          const field = numeric
            ? table.bigInteger(column)
            : table.specificType(column, 'NVARCHAR(512)');
          if (column === 'id') field.primary();
          else field.nullable();
        }
      });
      if (rows.length) await trx(name).insert(rows);
    }
    await trx.raw('CREATE VIEW current_eligible_factories AS SELECT * FROM eligible_factories');
    await trx.raw(
      'CREATE VIEW current_connected_measurement_points AS SELECT * FROM cems_wpms_connected_measurement_points',
    );
  });
}
