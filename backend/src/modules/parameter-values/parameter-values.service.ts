import { env } from '../../config/env';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';
import { parameterValuesRepository } from './parameter-values.repository';
import {
  type LatestParameterValueQuery,
  type LatestParameterValueResultDTO,
  type ListParameterValuesQuery,
  PARAMETER_VALUE_INTERVALS,
  type ParameterValueAccessContext,
  type ParameterValuesResultDTO,
  type ParameterValuesTableDTO,
} from './parameter-values.types';

export const parameterValuesService = {
  async listTables(access: ParameterValueAccessContext): Promise<ParameterValuesTableDTO[]> {
    const [tables, accessibleStationIds] = await Promise.all([
      parameterValuesRepository.listTables(),
      parameterValuesRepository.listAccessibleStationIds(access),
    ]);

    const accessible = new Set(accessibleStationIds);
    return tables.filter((table) => {
      const stationId = getStationIdFromTableName(table.tableName);
      return stationId ? accessible.has(stationId) : false;
    });
  },

  async list(
    query: ListParameterValuesQuery,
    access: ParameterValueAccessContext,
  ): Promise<ParameterValuesResultDTO> {
    await ensureStationAccess(query.stationId, access);

    const tableName = parameterValuesRepository.tableName(query.stationId, query.interval);
    const exists = await parameterValuesRepository.tableExists(tableName);
    if (!exists) {
      throw new NotFoundError(
        `Parameter value table ${env.PARAMETER_DB_SCHEMA}.${tableName} not found`,
      );
    }

    const result = await parameterValuesRepository.listRows(query);

    return {
      data: result.rows,
      meta: {
        stationId: query.stationId,
        interval: query.interval,
        schemaName: env.PARAMETER_DB_SCHEMA,
        tableName: result.tableName,
        startDate: query.startDate,
        endDate: query.endDate,
        count: result.rows.length,
      },
    };
  },

  async latest(
    query: LatestParameterValueQuery,
    access: ParameterValueAccessContext,
  ): Promise<LatestParameterValueResultDTO> {
    await ensureStationAccess(query.stationId, access);

    const tableName = parameterValuesRepository.tableName(query.stationId, query.interval);
    const exists = await parameterValuesRepository.tableExists(tableName);
    if (!exists) {
      throw new NotFoundError(
        `Parameter value table ${env.PARAMETER_DB_SCHEMA}.${tableName} not found`,
      );
    }

    const result = await parameterValuesRepository.latestRow(query);

    return {
      data: result.row,
      meta: {
        stationId: query.stationId,
        interval: query.interval,
        schemaName: env.PARAMETER_DB_SCHEMA,
        tableName: result.tableName,
        count: result.row ? 1 : 0,
      },
    };
  },
};

async function ensureStationAccess(
  stationId: string,
  access: ParameterValueAccessContext,
): Promise<void> {
  const hasAccess = await parameterValuesRepository.canAccessStation(stationId, access);
  if (!hasAccess) {
    throw new ForbiddenError(`Station ${stationId} is not available for this user`);
  }
}

function getStationIdFromTableName(tableName: string): string | null {
  for (const interval of PARAMETER_VALUE_INTERVALS) {
    const suffix = `_data_${interval}`;
    if (tableName.endsWith(suffix)) {
      return tableName.slice(0, -suffix.length);
    }
  }

  return null;
}
