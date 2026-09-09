import { z } from 'zod';
import type {
  MeasurementPointDetailsInput,
  MeasurementInstrumentsInput,
} from '../connection-requests/connection-requests.types';

export function parameterKey(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/gu, ' ');
}

export const requestedPointParametersSchema = z
  .array(z.string().trim().min(1).max(255))
  .max(100)
  .superRefine((values, ctx) => {
    const seen = new Set<string>();
    values.forEach((value, index) => {
      const key = parameterKey(value);
      if (seen.has(key) || ['ไม่มี', 'ได้รับการยกเว้นทั้งหมด'].includes(key)) {
        ctx.addIssue({
          code: 'custom',
          path: [index],
          message: 'Use unique measurement parameter names; represent an empty selection with []',
        });
      }
      seen.add(key);
    });
  });

export function requestedPointParameters(
  details: MeasurementPointDetailsInput | null | undefined,
): string[] | undefined {
  if (!details || !Object.prototype.hasOwnProperty.call(details, 'requestedParameters'))
    return undefined;
  return requestedPointParametersSchema.parse(details.requestedParameters);
}

export function alignPointInstruments(
  instruments: MeasurementInstrumentsInput | null,
  parameters: string[],
): MeasurementInstrumentsInput | null {
  if (!instruments) return null;
  const byParameter = new Map(
    (instruments.parameters ?? []).map((item) => [parameterKey(item.parameter), item]),
  );
  return {
    ...instruments,
    parameters: parameters.map((parameter) => ({
      ...byParameter.get(parameterKey(parameter)),
      parameter,
    })),
  };
}

// A legacy unitless channel can match one unambiguous approved parameter. Never
// equate two explicitly different units, or guess among multiple unit variants.
export function approvedParameterLabel(value: string, parameters: string[]): string | undefined {
  const key = parameterKey(value);
  const exact = parameters.find((parameter) => parameterKey(parameter) === key);
  if (exact !== undefined) return exact;
  const unit = /\([^)]*\)\s*$/u;
  const withoutUnit = (text: string) => parameterKey(text.replace(/\s*\([^)]*\)\s*$/u, ''));
  const candidates = parameters.filter(
    (parameter) =>
      (!unit.test(value) || !unit.test(parameter)) && withoutUnit(value) === withoutUnit(parameter),
  );
  return candidates.length === 1 ? candidates[0] : undefined;
}
