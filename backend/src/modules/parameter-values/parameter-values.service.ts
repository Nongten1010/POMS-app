import { env } from '../../config/env';
import { NotFoundError } from '../../shared/errors/AppError';
import { parameterValuesRepository } from './parameter-values.repository';
import {
  type ListParameterValuesQuery,
  type ParameterValuesResultDTO,
  type ParameterValuesTableDTO,
} from './parameter-values.types';

export const parameterValuesService = {
  listTables(): Promise<ParameterValuesTableDTO[]> {
    return parameterValuesRepository.listTables();
  },

  async list(query: ListParameterValuesQuery): Promise<ParameterValuesResultDTO> {
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
        limit: query.limit,
        offset: query.offset,
        count: result.rows.length,
        hasMore: result.hasMore,
      },
    };
  },
};
