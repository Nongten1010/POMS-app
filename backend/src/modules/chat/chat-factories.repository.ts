import type { Knex } from 'knex';
import { db } from '../../config/database';
import { applySelectedFactoryAccessFilters } from '../eligible-factories/eligible-factories.access';
import { factoryProfileReadTable } from '../factory-profiles/factory-profile-mode';
import { resolveAssignedRegions } from '../auth/regional-access';
import { NotFoundError } from '../../shared/errors/AppError';
import type {
  ChatAccess,
  ChatFactory,
  ChatFactoryQuery,
  ChatMeasurementPoint,
  ChatPage,
  ChatPointReference,
} from './chat.types';

type Executor = Knex | Knex.Transaction;
interface FactoryRow {
  id: number | string;
  name: string;
  registrationNo: string;
  provinceName: string;
  regionName: string | null;
}

/** The caller joins current eligible factories as ef and provinces as p. */
export function applyChatFactoryAccess(
  builder: Knex.QueryBuilder,
  access: ChatAccess,
): Knex.QueryBuilder {
  const scope = access.factoryScope?.scope;
  const province = access.factoryScope?.province?.trim();
  const regions =
    scope === 'IN_REGION'
      ? resolveAssignedRegions(access.factoryScope?.region, access.regionalAccess)
      : [];
  const estateCode = access.factoryScope?.estateCode?.trim();
  const estate = estateCode || access.factoryScope?.estate?.trim();
  const requiresAssignment = access.userType === 'operator' || scope === 'OWN_FACTORY';
  applySelectedFactoryAccessFilters(
    builder,
    {
      denyAll:
        !['operator', 'officer', 'admin'].includes(access.userType) ||
        !access.roles.length ||
        !Number.isSafeInteger(access.actorUserId) ||
        access.actorUserId <= 0 ||
        ![
          'ALL',
          'OWN_FACTORY',
          'IN_PROVINCE',
          'IN_REGION',
          'IN_ESTATE',
          'FACTORY_TYPE_88',
        ].includes(scope ?? '') ||
        (scope === 'IN_PROVINCE' && !province) ||
        (scope === 'IN_REGION' && !regions.length) ||
        (scope === 'IN_ESTATE' && !estate),
      regionNames: regions,
      provinceNames: scope === 'IN_PROVINCE' && province ? [province] : [],
      estateCodes: [],
      estateNames: [],
      requireAssignedFactory: requiresAssignment,
      requireFactoryType88: scope === 'FACTORY_TYPE_88',
    },
    access.actorUserId,
  );
  if (requiresAssignment) {
    // The shared access helper accepts either source ID or registration. Chat
    // requires one matching master across current and retired identities; the
    // shared helper separately requires that master and its grant to be active.
    // A recycled registration must not reassign historical tickets to new owners.
    builder.whereRaw(`(
      SELECT COUNT(*) FROM factories AS chat_identity
      WHERE (
        chat_identity.code = ef.factory_registration_no_new OR
        chat_identity.fid = ef.factory_registration_no_new OR
        chat_identity.fid = ef.source_factory_id OR
        chat_identity.code = ef.source_factory_id
      )
    ) = 1`);
  }
  if (scope === 'IN_ESTATE' && estate) {
    builder.whereExists(function assignedEstate() {
      this.select(db.raw('1'))
        .from('industrial_estates as chat_estate')
        .whereRaw('?? = ??', ['chat_estate.name_th', 'ef.industrial_estate_name'])
        .where(function estateIdentifier() {
          this.where('chat_estate.code', estate);
          if (!estateCode) this.orWhere('chat_estate.name_th', estate);
        });
    });
  }
  return builder;
}

function factoryQuery(access: ChatAccess, executor: Executor): Knex.QueryBuilder {
  return applyChatFactoryAccess(
    executor(factoryProfileReadTable('eligible_factories', 'ef'))
      .leftJoin('provinces as p', 'p.name_th', 'ef.province_name')
      .whereNull('ef.deleted_at'),
    access,
  );
}

function selectFactory(builder: Knex.QueryBuilder): Knex.QueryBuilder<FactoryRow, FactoryRow[]> {
  return builder.select(
    'ef.id as id',
    'ef.factory_name as name',
    'ef.factory_registration_no_new as registrationNo',
    'ef.province_name as provinceName',
    'p.region as regionName',
  );
}

export async function listChatFactories(
  access: ChatAccess,
  query: ChatFactoryQuery,
  executor: Executor = db,
): Promise<ChatPage<ChatFactory>> {
  const base = factoryQuery(access, executor);
  if (query.q?.trim()) {
    const pattern = `%${query.q.trim().replace(/[~%_\[]/gu, (character) => `~${character}`)}%`;
    base.where(function searchFactories() {
      this.whereRaw("ef.factory_name LIKE ? ESCAPE '~'", [pattern]).orWhereRaw(
        "ef.factory_registration_no_new LIKE ? ESCAPE '~'",
        [pattern],
      );
    });
  }
  const count = await base.clone().count<{ total: number | string }>('ef.id as total').first();
  const total = Number(count?.total ?? 0);
  const paginated = query.page !== undefined || query.pageSize !== undefined;
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 25;
  const rowsQuery = selectFactory(base).orderBy('ef.factory_name', 'asc').orderBy('ef.id', 'asc');
  if (paginated) rowsQuery.offset((page - 1) * pageSize).limit(pageSize);
  const rows = await rowsQuery;
  return {
    data: rows.map((row) => ({ ...row, id: Number(row.id) })),
    pagination: {
      page,
      pageSize: paginated ? pageSize : total,
      total,
      totalPages: paginated ? Math.ceil(total / pageSize) : total > 0 ? 1 : 0,
    },
  };
}

export async function findChatFactory(
  access: ChatAccess,
  id: number,
  executor: Executor = db,
): Promise<ChatFactory | null> {
  if (executor.isTransaction && !(await lockFactoryRow(executor, id))) return null;
  const query = selectFactory(factoryQuery(access, executor).where('ef.id', id));
  const row = await query.first();
  return row ? { ...row, id: Number(row.id) } : null;
}

function lockFactoryRow(executor: Knex | Knex.Transaction, id: number) {
  // Locks must use base tables and join-free queries: MSSQL places UPDLOCK after
  // the last JOIN ON otherwise, which is not valid table-hint syntax.
  return executor('eligible_factories')
    .where('id', id)
    .whereNull('deleted_at')
    .forUpdate()
    .first<{ monitoring_point_form_id: number | string | null }>('monitoring_point_form_id');
}

type PointRow = Omit<ChatMeasurementPoint, 'id' | 'kind'> & { id: number | string };

function pointQuery(
  access: ChatAccess,
  factoryId: number,
  kind: ChatMeasurementPoint['kind'],
  executor: Executor,
): Knex.QueryBuilder<PointRow, PointRow[]> {
  const query = factoryQuery(access, executor).where('ef.id', factoryId);
  if (kind === 'eligible') {
    query
      .innerJoin(
        'factory_monitoring_point_forms as chat_form',
        'chat_form.id',
        'ef.monitoring_point_form_id',
      )
      .innerJoin('factory_monitoring_points as chat_point', 'chat_point.form_id', 'chat_form.id')
      .whereNull('chat_form.deleted_at');
  } else {
    query.innerJoin(
      factoryProfileReadTable('cems_wpms_connected_measurement_points', 'chat_point'),
      'chat_point.eligible_factory_id',
      'ef.id',
    );
  }
  return query
    .whereNull('chat_point.deleted_at')
    .select(
      'chat_point.id as id',
      'chat_point.system_type as systemType',
      'chat_point.point_code as pointCode',
      'chat_point.point_name as pointName',
    );
}

export async function listChatMeasurementPoints(
  access: ChatAccess,
  factoryId: number,
  executor: Executor = db,
): Promise<ChatMeasurementPoint[]> {
  if (!(await findChatFactory(access, factoryId, executor)))
    throw new NotFoundError('Factory not found');
  const rows = await pointQuery(access, factoryId, 'connected', executor).orderBy(
    'chat_point.id',
    'asc',
  );
  return rows.map((row) => ({ ...row, kind: 'connected', id: Number(row.id) }));
}

export async function findChatMeasurementPoint(
  access: ChatAccess,
  factoryId: number,
  reference: NonNullable<ChatPointReference>,
  executor: Executor = db,
): Promise<ChatMeasurementPoint | null> {
  if (executor.isTransaction) {
    const factory = await lockFactoryRow(executor, factoryId);
    if (!factory) return null;
    if (reference.kind === 'eligible') {
      if (factory.monitoring_point_form_id === null) return null;
      const form = await executor('factory_monitoring_point_forms')
        .where('id', factory.monitoring_point_form_id)
        .whereNull('deleted_at')
        .forUpdate()
        .first('id');
      if (!form) return null;
      const point = await executor('factory_monitoring_points')
        .where({ id: reference.id, form_id: factory.monitoring_point_form_id })
        .whereNull('deleted_at')
        .forUpdate()
        .first('id');
      if (!point) return null;
    } else {
      const point = await executor('cems_wpms_connected_measurement_points')
        .where({ id: reference.id, eligible_factory_id: factoryId })
        .whereNull('deleted_at')
        .forUpdate()
        .first('id');
      if (!point) return null;
    }
  }
  const query = pointQuery(access, factoryId, reference.kind, executor).where(
    'chat_point.id',
    reference.id,
  );
  const row = await query.first();
  return row ? { ...row, kind: reference.kind, id: Number(row.id) } : null;
}
