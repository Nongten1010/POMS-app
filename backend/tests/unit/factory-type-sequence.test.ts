import { describe, expect, it } from '@jest/globals';
import {
  joinFactoryTypeSequence,
  normalizeFactoryTypeSequence,
  splitFactoryTypeSequence,
} from '../../src/modules/eligible-factories/factory-type-sequence';
import { normalizeStoredFactoryTypeSequence } from '../../src/db/migrations/0043_rehydrate_eligible_factory_subclasses_from_source';

describe('factory type sequence normalization', () => {
  it.each([
    ['9200', '200,602,605', '0200,0602,0605'],
    ['9200', '602,605', '0602,0605'],
    ['0602', '200,602', '0200'],
    ['0902', '902', null],
    ['0902', '00902', null],
    ['2203', '203,204', '0203,0204'],
    ['4002', '002,403', '0002,0403'],
    ['0403', '000,00403', '0000'],
    ['6000', '07000,007001', '7000,7001'],
  ])(
    'removes subclass codes that repeat the main class for %s / %s',
    (factoryClass, factorySubclass, expectedSubclass) => {
      expect(normalizeFactoryTypeSequence(factoryClass, factorySubclass)).toEqual({
        factoryClass,
        factorySubclass: expectedSubclass,
      });
    },
  );

  it('normalizes stored factory type sequences when splitting selected eligible factories', () => {
    expect(splitFactoryTypeSequence('9200 / 200,602,605')).toEqual({
      factoryClass: '9200',
      factorySubclass: '0200,0602,0605',
    });
  });

  it('normalizes new stored factory type sequences when joining class and subclass values', () => {
    expect(joinFactoryTypeSequence('0602', '200,602')).toBe('0602 / 0200');
    expect(joinFactoryTypeSequence('0902', '902')).toBe('0902');
    expect(joinFactoryTypeSequence('0902', '00902')).toBe('0902');
  });

  it('rehydrates stored subclasses from raw FACCLASS values instead of padded stored values', () => {
    expect(normalizeStoredFactoryTypeSequence('5301 / 000,300,702', ['07000', '07300', '07702']))
      .toBe('5301 / 7000,7300,7702');
    expect(normalizeStoredFactoryTypeSequence('0403 / 000,003', ['00000', '00003']))
      .toBe('0403 / 0000,0003');
  });
});
