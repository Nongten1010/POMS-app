import { describe, expect, it } from '@jest/globals';
import {
  joinFactoryTypeSequence,
  normalizeFactoryTypeSequence,
  splitFactoryTypeSequence,
} from '../../src/modules/eligible-factories/factory-type-sequence';

describe('factory type sequence normalization', () => {
  it.each([
    ['9200', '200,602,605', '0602,0605'],
    ['9200', '602,605', '0602,0605'],
    ['0602', '200,602', '0200'],
    ['0902', '902', null],
    ['2203', '203,204', '0204'],
    ['4002', '002,403', '0403'],
    ['403', '000,003', '0000,0003'],
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
      factorySubclass: '0602,0605',
    });
  });

  it('normalizes new stored factory type sequences when joining class and subclass values', () => {
    expect(joinFactoryTypeSequence('0602', '200,602')).toBe('0602 / 0200');
    expect(joinFactoryTypeSequence('0902', '902')).toBe('0902');
  });
});
