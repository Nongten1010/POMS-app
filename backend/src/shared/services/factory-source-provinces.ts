import { db } from '../../config/database';
import { factorySourceDb, factorySourceTableName } from '../../config/factory-source-database';
import { diwProvinceCodeFromName } from '../../modules/eligible-factories/fac-import.mapper';
import { AppError } from '../errors/AppError';

export interface FactorySourceProvince {
  provinceId: string;
  provinceName: string;
}

export function factoryProvinceUnavailable(): AppError {
  return new AppError(
    'Factory province could not be verified with DIW. Please try again later.',
    503,
    'FACTORY_PROVINCE_UNAVAILABLE',
  );
}

/** FID identifies the plant; a registration prefix or login fallback is not a province source. */
export async function resolveFactorySourceProvinces(
  factoryIds: string[],
): Promise<Map<string, FactorySourceProvince>> {
  const ids = [...new Set(factoryIds.map((value) => value.trim()))];
  if (ids.length === 0) return new Map();
  if (ids.some((id) => !id || id.length > 64)) throw factoryProvinceUnavailable();

  try {
    const provinces = await db<{ id: string; name_th: string }>('provinces').select(
      'id',
      'name_th',
    );
    const byCode = new Map(
      provinces.map((province) => [
        diwProvinceCodeFromName(province.name_th),
        { provinceId: province.id, provinceName: province.name_th },
      ]),
    );
    const resolved = new Map<string, FactorySourceProvince>();
    for (let offset = 0; offset < ids.length; offset += 400) {
      const rows = await factorySourceDb<{ FID: string; PROV: string | number | null }>(
        factorySourceTableName(),
      )
        .whereIn('FID', ids.slice(offset, offset + 400))
        .select('FID', 'PROV')
        .timeout(10_000);
      for (const row of rows) {
        const code = String(row.PROV ?? '').trim();
        const province = /^\d{1,2}$/.test(code) ? byCode.get(code.padStart(2, '0')) : undefined;
        const id = row.FID.trim();
        const previous = resolved.get(id);
        if (!province || (previous && previous.provinceId !== province.provinceId)) {
          throw factoryProvinceUnavailable();
        }
        resolved.set(id, province);
      }
    }
    if (ids.some((id) => !resolved.has(id))) throw factoryProvinceUnavailable();
    return resolved;
  } catch {
    // Do not leak database hosts, credentials, SQL text or upstream payloads to the client.
    throw factoryProvinceUnavailable();
  }
}
