import { describe, expect, it } from '@jest/globals';
import {
  joinFactoryTypeSequence,
  normalizeFactoryTypeSequence,
  splitFactoryTypeSequence,
} from '../../src/modules/eligible-factories/factory-type-sequence';
import { normalizeStoredFactoryTypeSequence } from '../../src/db/migrations/0043_rehydrate_eligible_factory_subclasses_from_source';
import { normalizeStoredFactoryTypeSequence as normalizeStoredFactoryTypeSequenceToFiveDigits } from '../../src/db/migrations/0065_rehydrate_factory_type_sequences_to_five_digits';

describe('factory type sequence normalization', () => {
  it.each([
    ['9200', '200,602,605', '00200,00602,00605'],
    ['9200', '602,605', '00602,00605'],
    ['0602', '200,602', '00200'],
    ['0902', '902', null],
    ['0902', '00902', null],
    ['2203', '203,204', '00203,00204'],
    ['4002', '002,403', '00002,00403'],
    ['0403', '000,00403', '00000'],
    ['6000', '07000,007001', '07000,07001'],
  ])(
    'removes subclass codes that repeat the main class for %s / %s',
    (factoryClass, factorySubclass, expectedSubclass) => {
      expect(normalizeFactoryTypeSequence(factoryClass, factorySubclass)).toEqual({
        factoryClass: factoryClass.padStart(5, '0'),
        factorySubclass: expectedSubclass,
      });
    },
  );

  it('normalizes stored factory type sequences when splitting selected eligible factories', () => {
    expect(splitFactoryTypeSequence('9200 / 200,602,605')).toEqual({
      factoryClass: '09200',
      factorySubclass: '00200,00602,00605',
    });
  });

  it('normalizes new stored factory type sequences when joining class and subclass values', () => {
    expect(joinFactoryTypeSequence('0602', '200,602')).toBe('00602 / 00200');
    expect(joinFactoryTypeSequence('0902', '902')).toBe('00902');
    expect(joinFactoryTypeSequence('0902', '00902')).toBe('00902');
  });

  it('rehydrates stored subclasses from raw FACCLASS values instead of padded stored values', () => {
    expect(
      normalizeStoredFactoryTypeSequence('5301 / 000,300,702', ['07000', '07300', '07702']),
    ).toBe('05301 / 07000,07300,07702');
    expect(normalizeStoredFactoryTypeSequence('0403 / 000,003', ['00000', '00003'])).toBe(
      '00403 / 00000,00003',
    );
  });

  it('backfills stored factory type sequences from source CLASS and FACCLASS as 5 digits', () => {
    expect(
      normalizeStoredFactoryTypeSequenceToFiveDigits('9200 / 200,602', '09200', [
        '09200',
        '00200',
        '00602',
      ]),
    ).toBe('09200 / 00200,00602');
    expect(normalizeStoredFactoryTypeSequenceToFiveDigits('8802 / 1', '08802', ['00001'])).toBe(
      '08802 / 00001',
    );
  });
});
