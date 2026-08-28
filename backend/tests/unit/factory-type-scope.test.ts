import { describe, expect, it } from '@jest/globals';
import { db } from '../../src/config/database';
import {
  applyFactoryType88Filter,
  isFactoryType88,
  normalizeFactoryTypeCode,
} from '../../src/shared/utils/factory-type-scope';

describe('factory type 88 scope', () => {
  it('normalizes factory type codes to the canonical five-digit form', () => {
    expect(normalizeFactoryTypeCode('88')).toBe('00088');
    expect(normalizeFactoryTypeCode('000088')).toBe('00088');
    expect(isFactoryType88('00088')).toBe(true);
    expect(isFactoryType88('00089')).toBe(false);
  });

  it('builds a parameterized filter across equivalent source columns', () => {
    const builder = db('source as s');
    applyFactoryType88Filter(builder, ['s.factory_type_sequence', 's.factory_main_type_code']);
    const compiled = builder.toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('[s].[factory_type_sequence]');
    expect(sql).toContain('[s].[factory_main_type_code]');
    expect(sql).toContain('right(replicate');
    expect(compiled.bindings.filter((binding) => binding === '00088')).toHaveLength(2);
  });
});
