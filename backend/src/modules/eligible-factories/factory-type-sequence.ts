import type { EligibleFactoryCandidateDTO } from './eligible-factories.types';

const FACTORY_TYPE_CODE_LENGTH = 5;

export function joinFactoryTypeSequence(
  factoryClass?: string | null,
  factorySubclass?: string | null,
): string | null {
  const normalized = normalizeFactoryTypeSequence(factoryClass, factorySubclass);
  return (
    [normalized.factoryClass, normalized.factorySubclass]
      .filter((value): value is string => Boolean(value))
      .join(' / ') || null
  );
}

export function splitFactoryTypeSequence(
  value: string | null,
): Pick<EligibleFactoryCandidateDTO, 'factoryClass' | 'factorySubclass'> {
  if (!value) return { factoryClass: null, factorySubclass: null };

  const separatorIndex = value.indexOf('/');
  const factoryClass = separatorIndex >= 0 ? value.slice(0, separatorIndex).trim() : value.trim();
  const factorySubclass = separatorIndex >= 0 ? value.slice(separatorIndex + 1).trim() : null;

  return normalizeFactoryTypeSequence(factoryClass || null, factorySubclass || null);
}

export function normalizeFactoryTypeSequence(
  factoryClass?: string | null,
  factorySubclass?: string | null,
): Pick<EligibleFactoryCandidateDTO, 'factoryClass' | 'factorySubclass'> {
  const normalizedClass = normalizeFactoryTypeCode(factoryClass);
  const duplicateSubclassCode = normalizedClass
    ? factorySubclassCodeFromMainClass(normalizedClass)
    : null;
  const subclassCodes = new Set<string>();

  for (const token of normalizeText(factorySubclass)?.split(/[,\s/|;]+/) ?? []) {
    const subclassCode = normalizeSubclassToken(token);
    if (!subclassCode || subclassCode === duplicateSubclassCode) continue;
    subclassCodes.add(subclassCode);
  }

  return {
    factoryClass: normalizedClass,
    factorySubclass: subclassCodes.size > 0 ? [...subclassCodes].join(',') : null,
  };
}

function normalizeText(value?: string | null): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function normalizeFactoryTypeCode(value?: string | null): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  const digits = text.replace(/\D/g, '');
  if (!digits) return text;
  return digits.slice(-FACTORY_TYPE_CODE_LENGTH).padStart(FACTORY_TYPE_CODE_LENGTH, '0');
}

function factorySubclassCodeFromMainClass(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  if (!digits) return null;
  return digits.slice(-FACTORY_TYPE_CODE_LENGTH).padStart(FACTORY_TYPE_CODE_LENGTH, '0');
}

function normalizeSubclassToken(value: string): string | null {
  const text = value.trim();
  if (!text) return null;
  return factorySubclassCodeFromSource(text) ?? text;
}

function factorySubclassCodeFromSource(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  if (!digits) return null;
  return digits.slice(-FACTORY_TYPE_CODE_LENGTH).padStart(FACTORY_TYPE_CODE_LENGTH, '0');
}
