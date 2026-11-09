import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../../config/database';
import { env } from '../../config/env';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../../shared/errors/AppError';
import { authorize, getScopeDetails } from '../../shared/middlewares/authorize';
import { eligibleFactoriesRepository } from './eligible-factories.repository';
import {
  accessEvent,
  eligibleFactoryStatusSync,
  isFresh,
  lockEligibleFactory,
} from './eligible-factory-status-sync';

const positiveId = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const accessParams = z.object({ id: positiveId });
export const revokeParams = accessParams.extend({ grantId: positiveId });
const reason = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .transform((v) => v || undefined);
export const grantInput = z
  .object({ userId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), reason })
  .strict();
export const revokeInput = z.object({ reason }).strict();
export const candidateQuery = z.object({ query: z.string().trim().min(2).max(100) }).strict();

export function maskCitizenId(value: unknown): string {
  const text = String(value ?? '');
  return /^\d{13}$/.test(text) ? `*********${text.slice(-4)}` : '*************';
}
export function isoUtc(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(/[Zz]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`).toISOString();
}
const displayName = (row: { first_name?: string; last_name?: string }) =>
  [row.first_name, row.last_name].filter(Boolean).join(' ');

export const operatorAccessService = {
  async snapshot(id: number) {
    const source = await eligibleFactoryStatusSync.refresh(id);
    const factory = await db('eligible_factories').where('id', id).whereNull('deleted_at').first();
    if (!factory) throw new NotFoundError('Eligible factory not found');
    const rows = await db('user_eligible_factory_access as g')
      .join('users as u', 'u.id', 'g.user_id')
      .join('users as a', 'a.id', 'g.granted_by')
      .where('g.eligible_factory_id', id)
      .orderBy('g.id', 'desc')
      .select(
        'g.*',
        'u.external_id',
        'u.first_name',
        'u.last_name',
        'a.first_name as actor_first_name',
        'a.last_name as actor_last_name',
      );
    const history = await db('eligible_operator_access_events as e')
      .join('user_eligible_factory_access as g', 'g.id', 'e.grant_id')
      .join('users as u', 'u.id', 'g.user_id')
      .leftJoin('users as a', 'a.id', 'e.actor_user_id')
      .where('g.eligible_factory_id', id)
      .orderBy('e.id', 'desc')
      .select(
        'e.*',
        'u.first_name',
        'u.last_name',
        'a.first_name as actor_first_name',
        'a.last_name as actor_last_name',
      );
    const verified = source?.verified_fid === String(factory.factory_registration_no_new).trim();
    const canGrant = verified && isFresh(source) && source?.flag === '0' && !source.error_code;
    return {
      factory: {
        id,
        name: factory.factory_name,
        factoryRegistrationNo: factory.factory_registration_no_new,
        operationStatus: factory.operation_status,
        statusVerifiedAt: isoUtc(source?.last_success_at ?? null),
      },
      capabilities: {
        canGrant,
        grantUnavailableReason: canGrant
          ? null
          : !verified || !isFresh(source) || source?.error_code
            ? 'SOURCE_STATUS_UNVERIFIED'
            : 'FACTORY_NOT_NOT_STARTED',
      },
      items: rows.map((row) => ({
        id: Number(row.id),
        userId: Number(row.user_id),
        name: displayName(row),
        citizenIdMasked: maskCitizenId(row.external_id),
        status: row.status === 'active' && !isFresh(source) ? 'suspended' : row.status,
        grantedAt: isoUtc(row.granted_at),
        grantedByName: displayName({
          first_name: row.actor_first_name,
          last_name: row.actor_last_name,
        }),
        canRevoke: row.ended_at === null,
      })),
      history: history.map((row) => ({
        id: Number(row.id),
        occurredAt: isoUtc(row.occurred_at),
        action: row.action,
        name: displayName(row),
        actorName:
          row.actor_user_id === null
            ? 'ระบบ'
            : displayName({ first_name: row.actor_first_name, last_name: row.actor_last_name }),
        reason: row.reason ?? null,
      })),
    };
  },

  async candidates(id: number, query: string) {
    const users = await db('users as u')
      .where('u.identity_provider', 'i_industry')
      .whereIn('u.user_type', ['citizen', 'operator'])
      .where('u.is_active', true)
      .whereNull('u.deleted_at')
      .whereNotNull('u.last_login_at')
      .whereNotExists(function alreadyGranted() {
        this.select(db.raw('1'))
          .from('user_eligible_factory_access as g')
          .whereRaw('g.user_id = u.id')
          .where('g.eligible_factory_id', id)
          .whereNull('g.ended_at');
      })
      .where(function search() {
        // Escape LIKE metacharacters; all values remain bound parameters.
        const pattern = `%${query.replace(/[\[\]%_]/g, (c) => `[${c}]`)}%`;
        this.where('u.first_name', 'like', pattern).orWhere('u.last_name', 'like', pattern);
        this.orWhereRaw("CONCAT(u.first_name, N' ', u.last_name) LIKE ?", [pattern]);
        if (/^\d{13}$/.test(query)) this.orWhere('u.external_id', query);
      })
      .orderBy('u.first_name')
      .orderBy('u.id')
      .select('u.id', 'u.first_name', 'u.last_name', 'u.external_id');
    return {
      items: users.map((u) => ({
        userId: Number(u.id),
        name: displayName(u),
        citizenIdMasked: maskCitizenId(u.external_id),
      })),
    };
  },

  async grant(
    id: number,
    input: { userId: number; reason?: string },
    actor: number,
    access: Parameters<typeof eligibleFactoriesRepository.findAccessibleById>[1],
  ) {
    await eligibleFactoryStatusSync.refresh(id, true);
    return db.transaction(async (trx) => {
      const factory = await lockEligibleFactory(trx, id);
      if (!(await eligibleFactoriesRepository.findAccessibleById(id, access, trx)))
        throw new NotFoundError('Eligible factory not found');
      const source = await trx('eligible_factory_source_status')
        .where('eligible_factory_id', id)
        .first();
      if (
        !isFresh(source) ||
        source.error_code ||
        source.verified_fid !== String(factory.factory_registration_no_new).trim()
      )
        throw new ConflictError('Source status could not be verified', {
          reason: 'SOURCE_STATUS_UNVERIFIED',
        });
      if (source.flag !== '0')
        throw new ConflictError('Factory must be not started', {
          reason: 'FACTORY_NOT_NOT_STARTED',
        });
      const user = await trx('users')
        .from(trx.raw('users WITH (UPDLOCK, HOLDLOCK)'))
        .where('id', input.userId)
        .where('identity_provider', 'i_industry')
        .whereIn('user_type', ['citizen', 'operator'])
        .where('is_active', true)
        .whereNull('deleted_at')
        .whereNotNull('last_login_at')
        .first('id');
      if (!user) throw new NotFoundError('Previously authenticated i-industry account not found');
      const existing = await trx('user_eligible_factory_access')
        .where({ eligible_factory_id: id, user_id: input.userId })
        .whereNull('ended_at')
        .first('id');
      if (existing)
        throw new ConflictError('Account is already assigned', { reason: 'DUPLICATE_GRANT' });
      const [grant] = await trx('user_eligible_factory_access')
        .insert({
          eligible_factory_id: id,
          user_id: input.userId,
          status: 'active',
          factory_fid: String(factory.factory_registration_no_new).trim(),
          granted_by: actor,
          reason: input.reason ?? null,
        })
        .returning('id');
      await accessEvent(trx, Number(grant.id), 'granted', actor, input.reason ?? null);
      return { id: Number(grant.id) };
    });
  },

  async revoke(
    id: number,
    grantId: number,
    actor: number,
    note: string | undefined,
    access: Parameters<typeof eligibleFactoriesRepository.findAccessibleById>[1],
  ) {
    return db.transaction(async (trx) => {
      await lockEligibleFactory(trx, id);
      if (!(await eligibleFactoriesRepository.findAccessibleById(id, access, trx)))
        throw new NotFoundError('Eligible factory not found');
      const grant = await trx('user_eligible_factory_access')
        .where({ id: grantId, eligible_factory_id: id })
        .first();
      if (!grant) throw new NotFoundError('Grant not found');
      if (grant.ended_at !== null) throw new ConflictError('Grant has already ended');
      await trx('user_eligible_factory_access')
        .where('id', grantId)
        .update({ status: 'revoked', revoked_by: actor, ended_at: trx.raw('SYSUTCDATETIME()') });
      await accessEvent(trx, grantId, 'revoked', actor, note ?? null);
      return { id: grantId };
    });
  },
};

export function requireOperatorAccessAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user || (req.user.userType !== 'admin' && !req.user.roles.includes('admin'))) {
    return next(new ForbiddenError('Only admins may manage factory operator access'));
  }
  if (!env.ELIGIBLE_OPERATOR_ACCESS_ENABLED)
    return next(new AppError('Operator access is not enabled', 503, 'SERVICE_UNAVAILABLE'));
  next();
}
export const operatorAccessRoutes = Router({ mergeParams: true });
operatorAccessRoutes.use((req, res, next) => {
  // Application error logs never include the account search query.
  req.originalUrl = req.originalUrl.split('?')[0];
  res.setHeader('Cache-Control', 'no-store');
  next();
});
operatorAccessRoutes.use(authorize('eligible_factories:view'), requireOperatorAccessAdmin);
const handler =
  (run: (req: Request, id: number) => Promise<unknown>, status = 200) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = accessParams.parse(req.params);
      const access = actorAccess(req);
      if (!(await eligibleFactoriesRepository.findAccessibleById(id, access)))
        throw new NotFoundError('Eligible factory not found');
      res.status(status).json({ success: true, data: await run(req, id) });
    } catch (error) {
      // Do not leak SQL bindings or full citizen IDs into generic error logs.
      next(
        error instanceof AppError || error instanceof z.ZodError
          ? error
          : new AppError('Operator access request failed', 500, 'INTERNAL_ERROR'),
      );
    }
  };
function actorAccess(req: Request) {
  if (!req.user) throw new UnauthorizedError();
  return {
    actorUserId: req.user.id,
    scope: getScopeDetails(req, 'eligible_factories:view'),
    regionalAccess: req.user.regionalAccess,
  };
}
operatorAccessRoutes.get(
  '/',
  handler((_req, id) => operatorAccessService.snapshot(id)),
);
operatorAccessRoutes.get(
  '/candidates',
  handler((req, id) => operatorAccessService.candidates(id, candidateQuery.parse(req.query).query)),
);
operatorAccessRoutes.post(
  '/',
  handler(
    (req, id) =>
      operatorAccessService.grant(
        id,
        grantInput.parse(req.body),
        actorAccess(req).actorUserId,
        actorAccess(req),
      ),
    201,
  ),
);
operatorAccessRoutes.post(
  '/:grantId/revoke',
  handler((req, id) =>
    operatorAccessService.revoke(
      id,
      revokeParams.parse(req.params).grantId,
      actorAccess(req).actorUserId,
      revokeInput.parse(req.body).reason,
      actorAccess(req),
    ),
  ),
);
