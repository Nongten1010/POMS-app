import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors/AppError';
import { eligibleFactoriesRepository } from '../eligible-factories/eligible-factories.repository';
import { resolveEligibleFactoryAddressForStorage } from '../eligible-factories/eligible-factory-source-hydration';
import { joinFactoryTypeSequence } from '../eligible-factories/factory-type-sequence';
import type {
  CreateEligibleFactoryInput,
  EligibleFactoryDTO,
} from '../eligible-factories/eligible-factories.types';
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

    const created = await monitoringPointFormsRepository.create(input, actorUserId);
    await syncEligibleFactoryFromForm(created, actorUserId, { requireRegistration: false });
    return created;
  },

  async update(
    id: number,
    input: SaveMonitoringPointFormInput,
    actorUserId: number,
  ): Promise<MonitoringPointFormDTO> {
    const updated = await monitoringPointFormsRepository.update(id, input, actorUserId);
    if (!updated) throw new NotFoundError('Monitoring point form not found');
    await syncEligibleFactoryFromForm(updated, actorUserId, { requireRegistration: false });
    return updated;
  },

  async selectEligible(id: number, actorUserId: number): Promise<EligibleFactoryDTO> {
    const form = await monitoringPointFormsRepository.findById(id);
    if (!form) throw new NotFoundError('Monitoring point form not found');

    const selected = await syncEligibleFactoryFromForm(form, actorUserId, {
      requireRegistration: true,
    });
    if (!selected) throw new Error('Eligible factory selection could not be synchronized');
    return selected;
  },
};

async function syncEligibleFactoryFromForm(
  form: MonitoringPointFormDTO,
  actorUserId: number,
  options: { requireRegistration: boolean },
): Promise<EligibleFactoryDTO | null> {
  const rawInput = buildEligibleFactoryInput(form, options);
  if (!rawInput) return null;
  const resolvedAddress = await resolveEligibleFactoryAddressForStorage({
    sourceFactoryId: rawInput.sourceFactoryId ?? null,
    factoryRegistrationNoNew: rawInput.factoryRegistrationNoNew,
    address: rawInput.address,
  });
  const input: CreateEligibleFactoryInput = {
    ...rawInput,
    address: resolvedAddress,
  };

  const existingByForm = await eligibleFactoriesRepository.findByMonitoringPointFormId(form.id);
  if (existingByForm) {
    const updated = await eligibleFactoriesRepository.updateFromMonitoringPointForm(
      existingByForm.id,
      input,
      actorUserId,
    );
    if (!updated) throw new NotFoundError('Eligible factory selection not found');
    return updated;
  }

  const existingByRegistration = await eligibleFactoriesRepository.findByRegistrationNoNew(
    input.factoryRegistrationNoNew,
  );
  if (
    existingByRegistration?.monitoringPointFormId &&
    existingByRegistration.monitoringPointFormId !== form.id
  ) {
    throw new ConflictError(
      'Factory registration is already linked to another monitoring point form',
      {
        factoryRegistrationNoNew: input.factoryRegistrationNoNew,
        monitoringPointFormId: existingByRegistration.monitoringPointFormId,
      },
    );
  }

  if (existingByRegistration) {
    const updated = await eligibleFactoriesRepository.updateFromMonitoringPointForm(
      existingByRegistration.id,
      input,
      actorUserId,
    );
    if (!updated) throw new NotFoundError('Eligible factory selection not found');
    return updated;
  }

  return eligibleFactoriesRepository.create(input, actorUserId);
}

function buildEligibleFactoryInput(
  form: MonitoringPointFormDTO,
  options: { requireRegistration: boolean },
): CreateEligibleFactoryInput | null {
  const registrationNoNew = form.factory.factoryRegistrationNoNew?.trim();
  if (!registrationNoNew) {
    if (!options.requireRegistration) return null;
    throw new BadRequestError(
      'Factory registration number is required before selecting eligible factory',
      {
        field: 'factory.factoryRegistrationNoNew',
      },
    );
  }

  return {
    sourceSystem: 'monitoring_point_forms',
    sourceFactoryId: registrationNoNew,
    monitoringPointFormId: form.id,
    factoryName: form.factory.factoryName?.trim() || registrationNoNew,
    factoryRegistrationNoNew: registrationNoNew,
    factoryRegistrationNoOld: form.factory.factoryRegistrationNoOld ?? null,
    factoryTypeSequence: joinFactoryTypeSequence(
      form.factory.factoryTypeMain,
      form.factory.factoryTypeSub,
    ),
    address: form.factory.address ?? null,
    provinceName: form.factory.provinceName?.trim() || '-',
    industrialEstateName: null,
    coordinates: buildCoordinates(form.factory.latitude, form.factory.longitude),
    businessActivity: form.factory.businessActivity ?? null,
    operationStatus: form.factory.operationStatus?.trim() || '-',
    machineryHorsepower: form.factory.machineryHorsepower ?? null,
    productionCapacity: buildProductionCapacitySummary(form),
    fuelUsed: buildFuelSummary(form),
    hasEia: parseEiaFlag(form.factory.eiaInfo),
    selectedReason: 'selected_from_monitoring_point_form',
  };
}

function buildCoordinates(
  latitude?: number | null,
  longitude?: number | null,
): { latitude: number; longitude: number } | null {
  return latitude === null ||
    latitude === undefined ||
    longitude === null ||
    longitude === undefined
    ? null
    : { latitude, longitude };
}

function buildProductionCapacitySummary(form: MonitoringPointFormDTO): string | null {
  const values = form.points
    .map((point) => point.productionCapacity?.trim())
    .filter((value): value is string => Boolean(value));

  return values.length ? Array.from(new Set(values)).join(', ') : null;
}

function buildFuelSummary(form: MonitoringPointFormDTO): string | null {
  const values = form.points
    .flatMap((point) => [
      point.primaryFuel?.trim(),
      point.primaryFuelOther?.trim(),
      point.secondaryFuel?.trim(),
      point.secondaryFuelOther?.trim(),
    ])
    .filter((value): value is string => Boolean(value));

  return values.length ? Array.from(new Set(values)).join(', ') : null;
}

function parseEiaFlag(value?: string | null): boolean | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === '-') return null;
  if (normalized.includes('ไม่มี')) return false;
  if (normalized.includes('มี') || normalized === 'yes' || normalized === 'true') return true;
  return null;
}
