import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors/AppError';
import { eligibleFactoriesRepository } from '../eligible-factories/eligible-factories.repository';
import { resolveEligibleFactoryAddressForStorage } from '../eligible-factories/eligible-factory-source-hydration';
import { withProvinceInFactoryAddress } from '../eligible-factories/factory-address';
import { joinFactoryTypeSequence } from '../eligible-factories/factory-type-sequence';
import {
  CONNECTION_REQUEST_EIA_ASSESSMENTS,
  deriveHasEiaFromAssessment,
  type ConnectionRequestEiaAssessment,
} from '../connection-requests/connection-request-eia';
import type {
  CreateEligibleFactoryInput,
  EligibleFactoryDTO,
} from '../eligible-factories/eligible-factories.types';
import { monitoringPointFormsRepository } from './monitoring-point-forms.repository';
import type {
  ListMonitoringPointFormsQuery,
  MonitoringPointFormAccessContext,
  MonitoringPointFormDTO,
  MonitoringPointFormSummaryDTO,
  SaveMonitoringPointFormInput,
} from './monitoring-point-forms.types';

interface MonitoringPointFormsService {
  list(
    query: ListMonitoringPointFormsQuery,
    access?: MonitoringPointFormAccessContext,
  ): Promise<MonitoringPointFormSummaryDTO[]>;
  getById(id: number, access?: MonitoringPointFormAccessContext): Promise<MonitoringPointFormDTO>;
  create(
    input: SaveMonitoringPointFormInput,
    actorUserId: number,
    access?: MonitoringPointFormAccessContext,
  ): Promise<MonitoringPointFormDTO>;
  update(
    id: number,
    input: SaveMonitoringPointFormInput,
    actorUserId: number,
    access?: MonitoringPointFormAccessContext,
  ): Promise<MonitoringPointFormDTO>;
  selectEligible(
    id: number,
    actorUserId: number,
    access?: MonitoringPointFormAccessContext,
  ): Promise<EligibleFactoryDTO>;
}

export const monitoringPointFormsService: MonitoringPointFormsService = {
  async list(
    query: ListMonitoringPointFormsQuery,
    access?: MonitoringPointFormAccessContext,
  ): Promise<MonitoringPointFormSummaryDTO[]> {
    return monitoringPointFormsRepository.list(query, access);
  },

  async getById(
    id: number,
    access?: MonitoringPointFormAccessContext,
  ): Promise<MonitoringPointFormDTO> {
    const form = await monitoringPointFormsRepository.findById(id, access);
    if (!form) throw new NotFoundError('Monitoring point form not found');
    return form;
  },

  async create(
    input: SaveMonitoringPointFormInput,
    actorUserId: number,
    access?: MonitoringPointFormAccessContext,
  ): Promise<MonitoringPointFormDTO> {
    const normalizedInput = normalizeMonitoringPointFormAddress(input);
    if (
      access &&
      !(await monitoringPointFormsRepository.canAccessFactory(normalizedInput.factory, access))
    ) {
      throw new NotFoundError('Monitoring point form not found');
    }
    if (normalizedInput.factory.factoryRegistrationNoNew) {
      const existingForms = await (access
        ? monitoringPointFormsRepository.list(
            { factoryRegistrationNoNew: normalizedInput.factory.factoryRegistrationNoNew },
            access,
          )
        : monitoringPointFormsRepository.list({
            factoryRegistrationNoNew: normalizedInput.factory.factoryRegistrationNoNew,
          }));
      if (existingForms.length > 0) {
        throw new ConflictError('Monitoring point form already exists for this factory', {
          id: existingForms[0]?.id,
          factoryRegistrationNoNew: normalizedInput.factory.factoryRegistrationNoNew,
        });
      }
    }

    const created = await monitoringPointFormsRepository.create(normalizedInput, actorUserId);
    await syncEligibleFactoryFromForm(created, actorUserId, { requireRegistration: false });
    return created;
  },

  async update(
    id: number,
    input: SaveMonitoringPointFormInput,
    actorUserId: number,
    access?: MonitoringPointFormAccessContext,
  ): Promise<MonitoringPointFormDTO> {
    const normalizedInput = normalizeMonitoringPointFormAddress(input);
    if (access && !(await monitoringPointFormsRepository.findById(id, access))) {
      throw new NotFoundError('Monitoring point form not found');
    }
    if (
      access &&
      !(await monitoringPointFormsRepository.canAccessFactory(normalizedInput.factory, access))
    ) {
      throw new NotFoundError('Monitoring point form not found');
    }
    const updated = await monitoringPointFormsRepository.update(
      id,
      normalizedInput,
      actorUserId,
      access,
    );
    if (!updated) throw new NotFoundError('Monitoring point form not found');
    await syncEligibleFactoryFromForm(updated, actorUserId, { requireRegistration: false });
    return updated;
  },

  async selectEligible(
    id: number,
    actorUserId: number,
    access?: MonitoringPointFormAccessContext,
  ): Promise<EligibleFactoryDTO> {
    const form = await monitoringPointFormsRepository.findById(id, access);
    if (!form) throw new NotFoundError('Monitoring point form not found');

    const selected = await syncEligibleFactoryFromForm(form, actorUserId, {
      requireRegistration: true,
    });
    if (!selected) throw new Error('Eligible factory selection could not be synchronized');
    return selected;
  },
};

function normalizeMonitoringPointFormAddress(
  input: SaveMonitoringPointFormInput,
): SaveMonitoringPointFormInput {
  return {
    ...input,
    factory: {
      ...input.factory,
      address: withProvinceInFactoryAddress(input.factory.address, input.factory.provinceName),
    },
  };
}

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
    provinceName: rawInput.provinceName,
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
    ...buildEligibleFactoryEiaPatch(form.factory.eiaInfo, form.factory.eiaOther),
    ...(form.factory.projectName != null ? { projectName: form.factory.projectName } : {}),
    selectedReason: 'selected_from_monitoring_point_form',
  };
}

function buildEligibleFactoryEiaPatch(
  eiaInfo?: string | null,
  eiaOther?: string | null,
): Pick<CreateEligibleFactoryInput, 'eia' | 'eiaOther' | 'hasEia'> {
  const assessment = eiaInfo?.trim();
  if (isConnectionRequestEiaAssessment(assessment)) {
    return {
      eia: assessment,
      eiaOther: assessment === 'อื่นๆ' ? (eiaOther ?? null) : null,
      hasEia: deriveHasEiaFromAssessment(assessment),
    };
  }

  return {};
}

function isConnectionRequestEiaAssessment(value?: string): value is ConnectionRequestEiaAssessment {
  return CONNECTION_REQUEST_EIA_ASSESSMENTS.some((assessment) => assessment === value);
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
