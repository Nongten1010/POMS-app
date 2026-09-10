import { z } from 'zod';
const visibility = z.enum(['VISIBLE', 'HIDDEN']);
const patchFields = {
  visibility: visibility.optional(),
  connectionStatus: z.enum(['CONNECTED', 'DISCONNECTED']).optional(),
};
const parameter = z.object({ parameter: z.string().trim().min(1).max(200), visibility }).strict();
const point = z
  .object({
    connectedPointId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    ...patchFields,
    parameters: z.array(parameter).min(1).max(100).optional(),
  })
  .strict()
  .refine(
    (p) =>
      p.visibility !== undefined || p.connectionStatus !== undefined || p.parameters !== undefined,
    'Provide a status change',
  );
export const statusManagementParamsSchema = z.object({
  factoryId: z.string().trim().min(1).max(80),
});
export const statusManagementInputSchema = z
  .object({
    expectedRevision: z.number().int().min(0).max(2147483646),
    reason: z.string().trim().min(1).max(1000),
    factory: z
      .object(patchFields)
      .strict()
      .refine((p) => Object.keys(p).length > 0, 'Provide a status change')
      .optional(),
    measurementPoints: z.array(point).min(1).max(200).optional(),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (!input.factory && !input.measurementPoints)
      ctx.addIssue({ code: 'custom', message: 'Provide factory or measurementPoints changes' });
    const ids = new Set<number>();
    input.measurementPoints?.forEach((p, index) => {
      if (ids.has(p.connectedPointId))
        ctx.addIssue({
          code: 'custom',
          path: ['measurementPoints', index, 'connectedPointId'],
          message: 'Duplicate measurement point',
        });
      ids.add(p.connectedPointId);
      const keys = new Set<string>();
      p.parameters?.forEach((v, parameterIndex) => {
        const key = v.parameter.toLowerCase();
        if (keys.has(key))
          ctx.addIssue({
            code: 'custom',
            path: ['measurementPoints', index, 'parameters', parameterIndex, 'parameter'],
            message: 'Duplicate parameter',
          });
        keys.add(key);
      });
    });
  });
