import { ConflictError, NotFoundError } from '../../shared/errors/AppError';
import { monitoringPointFormsRepository } from './monitoring-point-forms.repository';
import type {
  ListMonitoringPointFormsQuery,
  MonitoringPointFormDTO,
  MonitoringPointFormSummaryDTO,
  SaveMonitoringPointFormInput,
} from './monitoring-point-forms.types';

export const monitoringPointFormsService = {
  async list(query: ListMonitoringPointFormsQuery): Promise<MonitoringPointFormSummaryDTO[]> {
    return monitoringPointFormsRepository.list(query);
  },

  async getById(id: number): Promise<MonitoringPointFormDTO> {
    const form = await monitoringPointFormsRepository.findById(id);
    if (!form) throw new NotFoundError('Monitoring point form not found');
    return form;
  },

  async create(
    input: SaveMonitoringPointFormInput,
    actorUserId: number,
  ): Promise<MonitoringPointFormDTO> {
    if (input.factory.factoryRegistrationNoNew) {
      const existingForms = await monitoringPointFormsRepository.list({
        factoryRegistrationNoNew: input.factory.factoryRegistrationNoNew,
      });
      if (existingForms.length > 0) {
        throw new ConflictError('Monitoring point form already exists for this factory', {
          id: existingForms[0]?.id,
          factoryRegistrationNoNew: input.factory.factoryRegistrationNoNew,
        });
      }
    }

    return monitoringPointFormsRepository.create(input, actorUserId);
  },

  async update(
    id: number,
    input: SaveMonitoringPointFormInput,
    actorUserId: number,
  ): Promise<MonitoringPointFormDTO> {
    const updated = await monitoringPointFormsRepository.update(id, input, actorUserId);
    if (!updated) throw new NotFoundError('Monitoring point form not found');
    return updated;
  },
};
