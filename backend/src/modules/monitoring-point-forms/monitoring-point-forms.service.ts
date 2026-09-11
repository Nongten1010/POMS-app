import type { Knex } from 'knex';
import { db } from '../../config/database';
import { isCanonicalFactoryProfilesEnabled } from '../factory-profiles/factory-profile-mode';
import { lockFactoryProfileInTransaction } from '../factory-profiles/factory-profiles.repository';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors/AppError';
import { eligibleFactoriesRepository } from '../eligible-factories/eligible-factories.repository';
import {
  resolveEligibleFactoryAddressForStorage,
  resolveEligibleFactoryIndustrialEstateForStorage,
} from '../eligible-factories/eligible-factory-source-hydration';
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
  MonitoringPointFormFactoryInput,
  MonitoringPointFormSummaryDTO,
  SaveMonitoringPointFormInput,
} from './monitoring-point-forms.types';

interface SyncEligibleFactoryOptions {
  requireRegistration: boolean;
  submittedFactory?: MonitoringPointFormFactoryInput;
}

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

    if (isCanonicalFactoryProfilesEnabled() && normalizedInput.factory.factoryRegistrationNoNew) {
      assertCanonicalFactoryEia(normalizedInput.factory.eiaInfo);
    }
    return db.transaction(async (trx) => {
      const created = await monitoringPointFormsRepository.create(
        normalizedInput,
        actorUserId,
        trx,
      );
      await syncEligibleFactoryFromForm(
        created,
        actorUserId,
        { requireRegistration: false, submittedFactory: normalizedInput.factory },
        trx,
      );
      if (!isCanonicalFactoryProfilesEnabled()) return created;
      const current = await monitoringPointFormsRepository.findById(created.id, undefined, trx);
      if (!current) throw new Error('Created monitoring point form could not be loaded');
      return current;
    });
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
    return db.transaction(async (trx) => {
      if (isCanonicalFactoryProfilesEnabled()) {
        const selected = await eligibleFactoriesRepository.findByMonitoringPointFormId(id, trx);
        if (selected && !normalizedInput.factory.factoryRegistrationNoNew?.trim()) {
          throw new ConflictError(
            'Cannot clear the registration number of a linked eligible factory',
            {
              field: 'factory.factoryRegistrationNoNew',
              eligibleFactoryId: selected.id,
            },
          );
        }
        if (selected || normalizedInput.factory.factoryRegistrationNoNew) {
          assertCanonicalFactoryEia(normalizedInput.factory.eiaInfo);
        }
        if (selected) await lockFactoryProfileInTransaction(trx, selected.id);
      }
      const updated = await monitoringPointFormsRepository.update(
        id,
        normalizedInput,
        actorUserId,
        access,
        trx,
      );
      if (!updated) throw new NotFoundError('Monitoring point form not found');
      await syncEligibleFactoryFromForm(
        updated,
        actorUserId,
        { requireRegistration: false, submittedFactory: normalizedInput.factory },
        trx,
      );
      if (!isCanonicalFactoryProfilesEnabled()) return updated;
      const current = await monitoringPointFormsRepository.findById(updated.id, undefined, trx);
      if (!current) throw new Error('Updated monitoring point form could not be loaded');
      return current;
    });
  },

  async selectEligible(
    id: number,
    actorUserId: number,
    access?: MonitoringPointFormAccessContext,
  ): Promise<EligibleFactoryDTO> {
    return db.transaction(async (trx) => {
      let form = await monitoringPointFormsRepository.findById(id, access, trx);
      if (!form) throw new NotFoundError('Monitoring point form not found');
      if (isCanonicalFactoryProfilesEnabled()) {
        const linked = await eligibleFactoriesRepository.findByMonitoringPointFormId(id, trx);
        if (linked) {
          await lockFactoryProfileInTransaction(trx, linked.id);
          form = await monitoringPointFormsRepository.findById(id, access, trx);
          if (!form) throw new NotFoundError('Monitoring point form not found');
          assertCanonicalFactoryEia(form.factory.eiaInfo);
          const current = await eligibleFactoriesRepository.findByMonitoringPointFormId(id, trx);
          if (!current) throw new NotFoundError('Eligible factory selection not found');
          return current;
        }
      }
      const selected = await syncEligibleFactoryFromForm(
        form,
        actorUserId,
        {
          requireRegistration: true,
        },
        trx,
      );
      if (!selected) throw new Error('Eligible factory selection could not be synchronized');
      return selected;
    });
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
  options: SyncEligibleFactoryOptions,
  trx: Knex.Transaction,
): Promise<EligibleFactoryDTO | null> {
  const rawInput = buildEligibleFactoryInput(form, options);
  if (!rawInput) return null;
  const existingByForm = await eligibleFactoriesRepository.findByMonitoringPointFormId(
    form.id,
    trx,
  );
  const existingByRegistration = existingByForm
    ? null
    : await eligibleFactoriesRepository.findByRegistrationNoNew(
        rawInput.factoryRegistrationNoNew,
        trx,
      );
  const hasCanonicalProfile =
    isCanonicalFactoryProfilesEnabled() && Boolean(existingByForm || existingByRegistration);
  const resolvedAddress = hasCanonicalProfile
    ? rawInput.address
    : await resolveEligibleFactoryAddressForStorage({
        sourceFactoryId: rawInput.sourceFactoryId ?? null,
        factoryRegistrationNoNew: rawInput.factoryRegistrationNoNew,
        address: rawInput.address,
        provinceName: rawInput.provinceName,
      });
  const resolvedIndustrialEstate = hasCanonicalProfile
    ? undefined
    : await resolveEligibleFactoryIndustrialEstateForStorage({
        sourceFactoryId: rawInput.sourceFactoryId ?? null,
        factoryRegistrationNoNew: rawInput.factoryRegistrationNoNew,
      });
  const input: CreateEligibleFactoryInput = {
    ...rawInput,
    address: resolvedAddress,
    ...(resolvedIndustrialEstate !== undefined
      ? { industrialEstateName: resolvedIndustrialEstate }
      : {}),
  };

  if (existingByForm) {
    const updated = await eligibleFactoriesRepository.updateFromMonitoringPointForm(
      existingByForm.id,
      input,
      actorUserId,
      trx,
    );
    if (!updated) throw new NotFoundError('Eligible factory selection not found');
    return updated;
  }

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
      trx,
    );
    if (!updated) throw new NotFoundError('Eligible factory selection not found');
    return updated;
  }

  return eligibleFactoriesRepository.create(input, actorUserId, trx);
}

function buildEligibleFactoryInput(
  form: MonitoringPointFormDTO,
  options: SyncEligibleFactoryOptions,
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
    coordinates: buildCoordinates(form.factory.latitude, form.factory.longitude),
    businessActivity: form.factory.businessActivity ?? null,
    operationStatus: form.factory.operationStatus?.trim() || '-',
    machineryHorsepower: form.factory.machineryHorsepower ?? null,
    productionCapacity: buildProductionCapacitySummary(form),
    fuelUsed: buildFuelSummary(form),
    ...buildEligibleFactoryEiaPatch(
      isCanonicalFactoryProfilesEnabled() && options.submittedFactory
        ? options.submittedFactory.eiaInfo
        : form.factory.eiaInfo,
      isCanonicalFactoryProfilesEnabled() && options.submittedFactory
        ? options.submittedFactory.eiaOther
        : form.factory.eiaOther,
    ),
    ...(form.factory.projectName != null ? { projectName: form.factory.projectName } : {}),
    selectedReason: 'selected_from_monitoring_point_form',
  };
}

function buildEligibleFactoryEiaPatch(
  eiaInfo?: string | null,
  eiaOther?: string | null,
): Pick<CreateEligibleFactoryInput, 'eia' | 'eiaOther' | 'hasEia'> {
  const assessment = eiaInfo?.trim();
  if (isCanonicalFactoryProfilesEnabled()) {
    assertCanonicalFactoryEia(eiaInfo);
    if (eiaInfo === undefined) return {};
    if (!assessment) return { eia: null, eiaOther: null, hasEia: null };
  }
  if (isConnectionRequestEiaAssessment(assessment)) {
    return {
      eia: assessment,
      eiaOther: assessment === 'อื่นๆ' ? (eiaOther ?? null) : null,
      hasEia: deriveHasEiaFromAssessment(assessment),
    };
  }

  return {};
}

function assertCanonicalFactoryEia(eiaInfo?: string | null): void {
  const assessment = eiaInfo?.trim();
  if (assessment && !isConnectionRequestEiaAssessment(assessment)) {
    throw new BadRequestError('Unsupported EIA assessment for a shared factory profile', {
      field: 'factory.eiaInfo',
      allowedValues: [...CONNECTION_REQUEST_EIA_ASSESSMENTS],
    });
  }
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
