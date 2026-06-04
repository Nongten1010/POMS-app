import { env } from '../../config/env';
import { NotFoundError } from '../../shared/errors/AppError';
import { parameterValuesRepository } from './parameter-values.repository';
import {
  type LatestParameterValueQuery,
  type LatestParameterValueResultDTO,
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
        startDate: query.startDate,
        endDate: query.endDate,
        count: result.rows.length,
      },
    };
  },

  async latest(query: LatestParameterValueQuery): Promise<LatestParameterValueResultDTO> {
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
