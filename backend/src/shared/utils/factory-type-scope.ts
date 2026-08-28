import type { Knex } from 'knex';

export const FACTORY_TYPE_88_CODE = '00088';
export const FACTORY_TYPE_88_SCOPE = 'FACTORY_TYPE_88';

const FACTORY_TYPE_CODE_LENGTH = 5;
const normalizedFactoryTypeSql =
  "RIGHT(REPLICATE('0', 5) + LTRIM(RTRIM(COALESCE(CONVERT(varchar(64), ??), ''))), 5) = ?";

/** Applies the category scope to one or more equivalent factory-type columns. */
export function applyFactoryType88Filter(
  builder: Knex.QueryBuilder,
  columns: string | readonly string[],
): void {
  const candidates = typeof columns === 'string' ? [columns] : [...columns];
  if (candidates.length === 0) {
    builder.whereRaw('1 = 0');
    return;
  }

  builder.where(function factoryType88Scope() {
    candidates.forEach((column, index) => {
      const bindings = [column, FACTORY_TYPE_88_CODE];
      if (index === 0) this.whereRaw(normalizedFactoryTypeSql, bindings);
      else this.orWhereRaw(normalizedFactoryTypeSql, bindings);
    });
  });
}

export function normalizeFactoryTypeCode(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  return normalized.slice(-FACTORY_TYPE_CODE_LENGTH).padStart(FACTORY_TYPE_CODE_LENGTH, '0');
}

export function isFactoryType88(value: unknown): boolean {
  return normalizeFactoryTypeCode(value) === FACTORY_TYPE_88_CODE;
}
