import type { GeneralInformationSystemType } from './general-information.validator';
import {
  listGeneralInformationPoints,
  type GeneralInformationPointRow,
} from './general-information.repository';
import { AppError } from '../../shared/errors/AppError';
import {
  managedStatusDTO,
  readPomsManagedStatuses,
} from '../poms-factories/poms-status-management.state';
import {
  defaultManagedStatus,
  type StoredFactoryStatus,
} from '../poms-factories/poms-status-management.types';

export const GENERAL_INFORMATION_REGIONS = [
  'ภาคเหนือ',
  'ภาคกลาง',
  'ภาคตะวันออกเฉียงเหนือ',
  'ภาคตะวันตก',
  'ภาคตะวันออก',
  'ภาคใต้',
] as const;

function incomplete(): never {
  throw new AppError(
    'ข้อมูลต้นทางไม่ครบถ้วนสำหรับสรุปข้อมูลทั่วไป',
    503,
    'GENERAL_INFORMATION_DATA_INCOMPLETE',
  );
}

function savedJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return incomplete();
  }
}

function pointParameters(row: GeneralInformationPointRow): string[] {
  const parsed = savedJson(row.parameters_json);
  if (
    !Array.isArray(parsed) ||
    !parsed.every((value): value is string => typeof value === 'string' && !!value.trim())
  )
    incomplete();
  return parsed;
}

function hiddenPoints(rows: GeneralInformationPointRow[]): Set<GeneralInformationPointRow> {
  const factories = new Map<number | null, GeneralInformationPointRow[]>();
  for (const row of rows) {
    const id = row.eligible_factory_id;
    const points = factories.get(id) ?? [];
    points.push(row);
    factories.set(id, points);
  }
  const hidden = new Set<GeneralInformationPointRow>();
  for (const points of factories.values()) {
    const stateJson = points[0].management_state_json;
    if (!stateJson) continue;
    try {
      const statuses = readPomsManagedStatuses(
        stateJson,
        points
          .filter((row) => row.deleted_at === null)
          .map((row) => ({ connectedPointId: Number(row.id), parameters: pointParameters(row) })),
      );
      const stored = savedJson(stateJson) as StoredFactoryStatus;
      for (const row of points) {
        // Historical points keep their saved override but cannot reopen a current parent.
        const status =
          statuses.measurementPoints.get(Number(row.id)) ??
          managedStatusDTO(
            stored.measurementPoints?.[String(row.id)] ?? defaultManagedStatus(),
            statuses.factory,
          );
        if (status.effectiveVisibility === 'HIDDEN') hidden.add(row);
      }
    } catch {
      incomplete();
    }
  }
  return hidden;
}

export async function getGeneralInformation(systemType: GeneralInformationSystemType) {
  const rows = await listGeneralInformationPoints(systemType);
  const hidden = hiddenPoints(rows);
  const latest = new Map<string, GeneralInformationPointRow>();
  const factoryKey = (row: GeneralInformationPointRow) => {
    const key =
      row.factory_registration_no_new?.trim() ||
      row.factory_registration_no?.trim() ||
      row.factory_id?.trim();
    if (!key) incomplete();
    return key.toUpperCase();
  };
  for (const row of rows) {
    if (row.system_type !== systemType) continue;
    const key = JSON.stringify([
      factoryKey(row),
      row.point_code?.trim().toUpperCase() || `source:${row.source_measurement_point_id}`,
    ]);
    const previous = latest.get(key);
    if (
      !previous ||
      new Date(row.updated_at).getTime() > new Date(previous.updated_at).getTime() ||
      (new Date(row.updated_at).getTime() === new Date(previous.updated_at).getTime() &&
        Number(row.id) > Number(previous.id))
    )
      latest.set(key, row);
  }
  const points = [...latest.values()].filter((row) => !hidden.has(row));
  const regionOf = (row: GeneralInformationPointRow) => {
    const region = ['ชัยนาท', 'อุทัยธานี'].includes(row.province_name ?? '')
      ? 'ภาคกลาง'
      : row.region;
    if (!GENERAL_INFORMATION_REGIONS.some((label) => label === region)) {
      throw new AppError(
        'ข้อมูลต้นทางไม่ครบถ้วนสำหรับสรุปข้อมูลทั่วไป',
        503,
        'GENERAL_INFORMATION_DATA_INCOMPLETE',
      );
    }
    return region;
  };
  const counts = (label: string, selected: GeneralInformationPointRow[]) => ({
    label,
    factoryCount: new Set(selected.map(factoryKey)).size,
    pointCount: selected.length,
  });
  const pointFlows = new Map(
    points.map((row) => {
      const parsed = savedJson(row.details_json ?? '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) incomplete();
      const details = parsed as Record<string, unknown>;
      const unit = String(
        details[systemType === 'CEMS' ? 'flowRateUnit' : 'wastewaterDischargeUnit'] ??
          (systemType === 'CEMS' ? 'm3/hr' : 'm3/d'),
      )
        .toLowerCase()
        .replace(/³/g, '3')
        .replace(/\s/g, '');
      const cubicMetresPerHour: Record<string, number> = {
        'm3/hr': 1,
        'm3/h': 1,
        'm3/d': 1 / 24,
        'm3/day': 1 / 24,
        'm3/s': 3600,
        'l/s': 3.6,
        'l/min': 0.06,
      };
      if (!Object.hasOwn(cubicMetresPerHour, unit)) incomplete();
      const factor = cubicMetresPerHour[unit] * (systemType === 'CEMS' ? 1 : 24);
      const fields =
        systemType === 'CEMS'
          ? ['averageFlowRate', 'minFlowRate', 'maxFlowRate']
          : ['averageWastewaterDischarge', 'minWastewaterDischarge', 'maxWastewaterDischarge'];
      const values = fields.map((field) => {
        const value = details[field];
        if (value == null || (typeof value === 'string' && !value.trim())) return null;
        if (
          typeof value !== 'number' &&
          (typeof value !== 'string' ||
            !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()))
        )
          incomplete();
        const converted = Number(value) * factor;
        if (!Number.isFinite(converted) || converted < 0) incomplete();
        return converted;
      });
      return [row, values] as const;
    }),
  );
  const flow = (label: string, selected: GeneralInformationPointRow[]) => {
    const values = [0, 1, 2].map((index) =>
      selected
        .map((row) => {
          const values = pointFlows.get(row);
          if (!values) incomplete();
          return values[index];
        })
        .filter((value): value is number => value !== null),
    );
    return {
      label,
      average: values[0].length
        ? values[0].reduce((sum, value) => sum + value / values[0].length, 0)
        : null,
      min: values[1].length
        ? values[1].reduce((min, value) => Math.min(min, value), Infinity)
        : null,
      max: values[2].length
        ? values[2].reduce((max, value) => Math.max(max, value), -Infinity)
        : null,
    };
  };
  const inEstate = (row: GeneralInformationPointRow) => {
    const name = row.industrial_estate_name?.trim() ?? '';
    if (['ไม่ทราบ', 'ไม่ระบุ', 'unknown', 'n/a', 'null', 'undefined'].includes(name.toLowerCase()))
      incomplete();
    return (
      !!name && !/^[-–—]+$/.test(name) && !['ไม่มี', 'นอกนิคมฯ', 'นอกนิคมอุตสาหกรรม'].includes(name)
    );
  };
  const parameterGroups = new Map<
    string,
    { label: string; units: Set<string>; points: Set<GeneralInformationPointRow> }
  >();
  const names: Record<string, string> = {
    co: 'CO',
    co2: 'CO2',
    nox: 'NOx',
    so2: 'SO2',
    o2: 'O2',
    bod: 'BOD',
    cod: 'COD',
    ph: 'pH',
    tss: 'TSS',
    flow: 'Flow Rate',
    flowrate: 'Flow Rate',
  };
  for (const row of points) {
    const parameters = pointParameters(row);
    for (const parameter of parameters) {
      const match = /^(.*?)(?:\s*\(([^()]*)\))?$/.exec(parameter.trim());
      if (!match) incomplete();
      const rawName = match[1].trim();
      if (!rawName) incomplete();
      const rawKey = rawName.toLowerCase().replace(/\s+/g, '');
      const label = Object.hasOwn(names, rawKey) ? names[rawKey] : rawName;
      const key = label.toLowerCase().replace(/\s+/g, '');
      const group = parameterGroups.get(key) ?? {
        label,
        units: new Set<string>(),
        points: new Set<GeneralInformationPointRow>(),
      };
      if (match[2]?.trim()) group.units.add(match[2].trim());
      group.points.add(row);
      parameterGroups.set(key, group);
    }
  }
  const parameters = [...parameterGroups.values()]
    .sort((a, b) => a.label.localeCompare(b.label, 'en'))
    .map((group) => {
      const units = [...group.units].sort();
      return {
        ...counts(group.label, [...group.points]),
        displayName: `${group.label} (${units.join(', ') || 'ไม่ระบุหน่วย'})`,
        units,
      };
    });
  return {
    systemType,
    generatedAt: new Date().toISOString(),
    regions: GENERAL_INFORMATION_REGIONS.map((label) =>
      counts(
        label,
        points.filter((row) => regionOf(row) === label),
      ),
    ),
    total: counts('ทั่วประเทศ', points),
    estates: [
      counts('ในนิคมฯ', points.filter(inEstate)),
      counts(
        'นอกนิคมฯ',
        points.filter((row) => !inEstate(row)),
      ),
    ],
    parameters,
    flowRates: GENERAL_INFORMATION_REGIONS.map((label) =>
      flow(
        label,
        points.filter((row) => regionOf(row) === label),
      ),
    ),
    flowTotal: flow('ทั่วประเทศ', points),
  };
}
