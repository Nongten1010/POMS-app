import { connectionRequestsService } from '../connection-requests/connection-requests.service';
import type {
  PaginatedTableRowsDTO,
  PublicFactoryMapPointDTO,
} from '../connection-requests/connection-requests.types';
import { NotFoundError } from '../../shared/errors/AppError';

export const integrationFactoryDashboardService = {
  async getByRegistrationNo(
    registrationNo: string,
  ): Promise<PaginatedTableRowsDTO<PublicFactoryMapPointDTO>> {
    const result = await connectionRequestsService.listPublicFactoryMapPoints({ registrationNo });
    const factory = result.data[0];

    if (!factory) {
      throw new NotFoundError('Connected POMS factory not found');
    }

    return { data: [factory], meta: { total: 1 } };
  },
};
