type OpenApiObject = Record<string, unknown>;

export type ValidationRequirement = 'required' | 'optional' | 'conditional';

export interface FieldValidationDocumentation {
  field: string;
  requirement: ValidationRequirement;
  nullable: boolean;
  type: string;
  rules: string[];
  condition?: string;
}

interface MediaTypeValidationDocumentation {
  mediaType: string;
  fields: FieldValidationDocumentation[];
  rules: string[];
}

interface TraversalContext {
  document: OpenApiObject;
  path: string;
  availability: 'always' | 'conditional';
  condition?: string;
  referenceStack: Set<string>;
}

const writeMethods = new Set(['post', 'put']);

function isObject(value: unknown): value is OpenApiObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function decodePointerSegment(value: string): string {
  return value.replace(/~1/g, '/').replace(/~0/g, '~');
}

function resolvePointer(document: OpenApiObject, reference: string): OpenApiObject | undefined {
  if (!reference.startsWith('#/')) return undefined;

  let current: unknown = document;
  for (const segment of reference.slice(2).split('/').map(decodePointerSegment)) {
    if (!isObject(current) || !(segment in current)) return undefined;
    current = current[segment];
  }

  return isObject(current) ? current : undefined;
}

function uniqueStrings(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values.filter((value): value is string => typeof value === 'string' && value.length > 0),
    ),
  );
}

function mergeSchemas(schemas: OpenApiObject[]): OpenApiObject {
  return schemas.reduce<OpenApiObject>((merged, schema) => {
    const mergedProperties = {
      ...(isObject(merged.properties) ? merged.properties : {}),
      ...(isObject(schema.properties) ? schema.properties : {}),
    };
    const required = uniqueStrings([
      ...(Array.isArray(merged.required) ? merged.required : []),
      ...(Array.isArray(schema.required) ? schema.required : []),
    ]);
    const descriptions = uniqueStrings([merged.description, schema.description]);

    return {
      ...merged,
      ...schema,
      ...(Object.keys(mergedProperties).length > 0 ? { properties: mergedProperties } : {}),
      ...(required.length > 0 ? { required } : {}),
      ...(descriptions.length > 0 ? { description: descriptions.join(' ') } : {}),
      ...(merged.additionalProperties === false || schema.additionalProperties === false
        ? { additionalProperties: false }
        : {}),
    };
  }, {});
}

function resolveSchema(
  rawSchema: unknown,
  document: OpenApiObject,
  referenceStack: Set<string>,
): OpenApiObject {
  if (!isObject(rawSchema)) return {};

  let schema = rawSchema;
  const reference = typeof schema.$ref === 'string' ? schema.$ref : undefined;
  if (reference && !referenceStack.has(reference)) {
    const resolved = resolvePointer(document, reference);
    if (resolved) {
      const nextStack = new Set(referenceStack);
      nextStack.add(reference);
      const siblings = Object.fromEntries(
        Object.entries(schema).filter(([key]) => key !== '$ref'),
      ) as OpenApiObject;
      schema = mergeSchemas([resolveSchema(resolved, document, nextStack), siblings]);
    }
  }

  if (Array.isArray(schema.allOf)) {
    const allOf = schema.allOf.map((part) => resolveSchema(part, document, referenceStack));
    const siblings = Object.fromEntries(
      Object.entries(schema).filter(([key]) => key !== 'allOf'),
    ) as OpenApiObject;
    schema = mergeSchemas([...allOf, siblings]);
  }

  return schema;
}

function inlineCode(value: unknown): string {
  return `\`${String(value).replace(/`/g, '\\`')}\``;
}

function enumRule(values: unknown[]): string {
  return `ค่าที่รับ: ${values.map(inlineCode).join(', ')}`;
}

function rangeRule(
  minimum: unknown,
  maximum: unknown,
  noun: string,
  unit = '',
): string | undefined {
  const label = noun.trimEnd();
  const hasMinimum = typeof minimum === 'number';
  const hasMaximum = typeof maximum === 'number';
  if (hasMinimum && hasMaximum) return `${label} ${minimum}–${maximum}${unit}`;
  if (hasMinimum) return `${label} อย่างน้อย ${minimum}${unit}`;
  if (hasMaximum) return `${label} ไม่เกิน ${maximum}${unit}`;
  return undefined;
}

function formatRule(format: string): string {
  const labels: Record<string, string> = {
    binary: 'ไฟล์ binary',
    date: 'วันที่รูปแบบ YYYY-MM-DD',
    'date-time': 'วันเวลา ISO 8601',
    email: 'อีเมลที่ถูกต้อง',
    hostname: 'hostname ที่ถูกต้อง',
    ipv4: 'IPv4 ที่ถูกต้อง',
    ipv6: 'IPv6 ที่ถูกต้อง',
    ['password']: 'ข้อความรหัสผ่าน',
    uri: 'URL/URI ที่ถูกต้อง',
    uuid: 'UUID ที่ถูกต้อง',
  };
  return labels[format] ?? `format: ${inlineCode(format)}`;
}

function schemaType(schema: OpenApiObject, document: OpenApiObject): string {
  if (schema.format === 'binary') return 'file';
  if (typeof schema.type === 'string' && schema.type !== 'array') return schema.type;
  if (schema.type === 'array') {
    const items = resolveSchema(schema.items, document, new Set());
    return `array<${schemaType(items, document)}>`;
  }
  if (isObject(schema.properties)) return 'object';
  for (const keyword of ['oneOf', 'anyOf'] as const) {
    const branches = Array.isArray(schema[keyword]) ? schema[keyword] : [];
    if (branches.length === 0) continue;

    const branchTypes = uniqueStrings(
      branches.map((branch) => {
        const resolved = resolveSchema(branch, document, new Set());
        return schemaType(resolved, document);
      }),
    );
    if (branchTypes.length > 0) return branchTypes.join(' หรือ ');
  }
  return 'any';
}

function schemaRules(schema: OpenApiObject, document: OpenApiObject): string[] {
  const rules: string[] = [];
  const length = rangeRule(schema.minLength, schema.maxLength, 'ความยาว ', ' ตัวอักษร');
  if (length) rules.push(length);

  const valueRange = rangeRule(schema.minimum, schema.maximum, 'ค่า ');
  if (valueRange) rules.push(valueRange);
  if (typeof schema.exclusiveMinimum === 'number') {
    rules.push(`ค่าต้องมากกว่า ${schema.exclusiveMinimum}`);
  }
  if (typeof schema.exclusiveMaximum === 'number') {
    rules.push(`ค่าต้องน้อยกว่า ${schema.exclusiveMaximum}`);
  }
  if (typeof schema.multipleOf === 'number') {
    rules.push(`ต้องหารด้วย ${schema.multipleOf} ลงตัว`);
  }

  const itemRange = rangeRule(schema.minItems, schema.maxItems, 'จำนวน ', ' รายการ');
  if (itemRange) rules.push(itemRange);
  if (schema.uniqueItems === true) rules.push('ห้ามมีค่าซ้ำ');

  const propertyRange = rangeRule(
    schema.minProperties,
    schema.maxProperties,
    'จำนวน field ',
    ' field',
  );
  if (propertyRange) rules.push(propertyRange);

  if (typeof schema.pattern === 'string') {
    rules.push(`ต้องตรง regex ${inlineCode(schema.pattern)}`);
  }
  if (typeof schema.format === 'string') rules.push(formatRule(schema.format));
  if (Array.isArray(schema.enum)) rules.push(enumRule(schema.enum));
  if ('const' in schema) rules.push(`ต้องเป็น ${inlineCode(schema.const)}`);
  if ('default' in schema) rules.push(`ค่าเริ่มต้น: ${inlineCode(JSON.stringify(schema.default))}`);
  if (schema.additionalProperties === false) rules.push('ไม่รับ field อื่นนอก schema');

  if (schema.type === 'array') {
    const itemSchema = resolveSchema(schema.items, document, new Set());
    const itemRules = schemaRules(itemSchema, document).filter(
      (rule) => rule !== 'ไม่รับ field อื่นนอก schema',
    );
    if (itemRules.length > 0 && !isObject(itemSchema.properties)) {
      rules.push(`แต่ละรายการ: ${itemRules.join('; ')}`);
    }
  }

  if (typeof schema.description === 'string' && schema.description.trim()) {
    rules.push(schema.description.trim());
  }

  return uniqueStrings(rules);
}

function branchLabel(rawBranch: unknown, branch: OpenApiObject, index: number): string {
  const rawReference =
    isObject(rawBranch) && typeof rawBranch.$ref === 'string' ? rawBranch.$ref : '';
  if (rawReference) return rawReference.split('/').pop() ?? `รูปแบบ ${index + 1}`;

  const properties = isObject(branch.properties) ? branch.properties : {};
  for (const [name, rawProperty] of Object.entries(properties)) {
    const property = isObject(rawProperty) ? rawProperty : {};
    if (Array.isArray(property.enum) && property.enum.length === 1) {
      return `${name}=${String(property.enum[0])}`;
    }
    if ('const' in property) return `${name}=${String(property.const)}`;
  }

  if (typeof branch.title === 'string' && branch.title.trim()) return branch.title.trim();
  if (typeof branch.description === 'string' && branch.description.trim()) {
    return branch.description.trim();
  }

  const required = uniqueStrings(Array.isArray(branch.required) ? branch.required : []);
  if (required.length > 0) return `มี ${required.join(' + ')}`;
  return `รูปแบบ ${index + 1}`;
}

function hasMeaningfulBranchLabels(labels: string[]): boolean {
  return labels.some((label) => !/^รูปแบบ \d+$/.test(label));
}

function requirementFor(
  isRequired: boolean,
  context: TraversalContext,
): Pick<FieldValidationDocumentation, 'requirement' | 'condition'> {
  if (!isRequired) {
    return {
      requirement: 'optional',
      ...(context.availability === 'conditional' && context.condition
        ? { condition: context.condition }
        : {}),
    };
  }
  if (context.availability === 'always') return { requirement: 'required' };
  return {
    requirement: 'conditional',
    ...(context.condition ? { condition: context.condition } : {}),
  };
}

function childAvailability(
  isRequired: boolean,
  fieldPath: string,
  context: TraversalContext,
): Pick<TraversalContext, 'availability' | 'condition'> {
  if (isRequired && context.availability === 'always') return { availability: 'always' };

  if (!isRequired) {
    const fieldCondition = `เมื่อส่ง ${fieldPath}`;
    return {
      availability: 'conditional',
      condition:
        context.availability === 'conditional' && context.condition
          ? `${context.condition} และ${fieldCondition}`
          : fieldCondition,
    };
  }

  return {
    availability: 'conditional',
    condition: context.condition,
  };
}

function collectProperties(
  rawSchema: unknown,
  context: TraversalContext,
  rows: FieldValidationDocumentation[],
  rootRules: string[],
): void {
  const schema = resolveSchema(rawSchema, context.document, context.referenceStack);
  const properties = isObject(schema.properties) ? schema.properties : {};
  const required = new Set(uniqueStrings(Array.isArray(schema.required) ? schema.required : []));

  for (const [name, rawProperty] of Object.entries(properties)) {
    const property = resolveSchema(rawProperty, context.document, context.referenceStack);
    const fieldPath = context.path ? `${context.path}.${name}` : name;
    const isRequired = required.has(name);
    const requirement = requirementFor(isRequired, context);
    rows.push({
      field: fieldPath,
      ...requirement,
      nullable: property.nullable === true,
      type: schemaType(property, context.document),
      rules: schemaRules(property, context.document),
    });

    const availability = childAvailability(isRequired, fieldPath, context);
    if (isObject(property.properties)) {
      collectProperties(
        property,
        {
          ...context,
          path: fieldPath,
          ...availability,
        },
        rows,
        rootRules,
      );
    }

    if (property.type === 'array' && property.items !== undefined) {
      const itemSchema = resolveSchema(property.items, context.document, context.referenceStack);
      if (isObject(itemSchema.properties) || Array.isArray(itemSchema.oneOf)) {
        collectSchema(
          itemSchema,
          {
            ...context,
            path: `${fieldPath}[]`,
            ...availability,
          },
          rows,
          rootRules,
        );
      }
    }

    if (Array.isArray(property.oneOf) || Array.isArray(property.anyOf)) {
      collectUnions(property, { ...context, path: fieldPath, ...availability }, rows, rootRules);
    }
  }
}

function collectUnions(
  schema: OpenApiObject,
  context: TraversalContext,
  rows: FieldValidationDocumentation[],
  rootRules: string[],
): void {
  for (const keyword of ['oneOf', 'anyOf'] as const) {
    const branches = Array.isArray(schema[keyword]) ? schema[keyword] : [];
    if (branches.length === 0) continue;

    const labels = branches.map((rawBranch, index) => {
      const branch = resolveSchema(rawBranch, context.document, context.referenceStack);
      return branchLabel(rawBranch, branch, index);
    });
    if (hasMeaningfulBranchLabels(labels)) {
      rootRules.push(
        keyword === 'oneOf'
          ? `ต้องตรงเพียง 1 รูปแบบ: ${labels.join(' หรือ ')}`
          : `ต้องตรงอย่างน้อย 1 รูปแบบ: ${labels.join(' หรือ ')}`,
      );
    }

    if (isObject(schema.properties)) {
      const requiredCounts = new Map<string, number>();
      branches.forEach((rawBranch) => {
        const branch = resolveSchema(rawBranch, context.document, context.referenceStack);
        uniqueStrings(Array.isArray(branch.required) ? branch.required : []).forEach((field) => {
          requiredCounts.set(field, (requiredCounts.get(field) ?? 0) + 1);
        });
      });

      const conditionalFields = Array.from(requiredCounts.keys());
      const condition = `${keyword === 'oneOf' ? 'เลือก 1 รูปแบบ' : 'อย่างน้อย 1 รูปแบบ'}: ${conditionalFields.join(
        ' หรือ ',
      )}`;
      requiredCounts.forEach((count, field) => {
        const fieldPath = context.path ? `${context.path}.${field}` : field;
        const row = rows.find((candidate) => candidate.field === fieldPath);
        if (!row || row.requirement === 'required') return;

        if (count === branches.length && context.availability === 'always') {
          row.requirement = 'required';
          delete row.condition;
          return;
        }

        row.requirement = 'conditional';
        row.condition = condition;
      });
      continue;
    }

    branches.forEach((rawBranch, index) => {
      const branch = resolveSchema(rawBranch, context.document, context.referenceStack);
      const label = labels[index];
      collectSchema(
        branch,
        {
          ...context,
          availability: 'conditional',
          condition: label,
        },
        rows,
        rootRules,
      );
    });
  }
}

function collectSchema(
  rawSchema: unknown,
  context: TraversalContext,
  rows: FieldValidationDocumentation[],
  rootRules: string[],
): void {
  const schema = resolveSchema(rawSchema, context.document, context.referenceStack);
  if (typeof schema.description === 'string' && schema.description.trim()) {
    rootRules.push(schema.description.trim());
  }
  if (schema.additionalProperties === false) rootRules.push('ไม่รับ field อื่นนอก schema');

  collectProperties(schema, context, rows, rootRules);
  collectUnions(schema, context, rows, rootRules);
}

function escapeMarkdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function requirementLabel(row: FieldValidationDocumentation): string {
  if (row.requirement === 'required') return 'บังคับ';
  if (row.requirement === 'conditional') {
    return row.condition ? `ตามเงื่อนไข: ${row.condition}` : 'ตามเงื่อนไข';
  }
  return row.condition ? `ไม่บังคับ (${row.condition})` : 'ไม่บังคับ';
}

function validationTable(fields: FieldValidationDocumentation[]): string {
  const rows = fields.map((field) => {
    const rules = field.rules.length > 0 ? field.rules.join('; ') : '—';
    return `| ${inlineCode(field.field)} | ${escapeMarkdownCell(requirementLabel(field))} | ${
      field.nullable ? 'ได้' : 'ไม่ได้'
    } | ${escapeMarkdownCell(inlineCode(field.type))} | ${escapeMarkdownCell(rules)} |`;
  });

  return [
    '| Field | การส่งค่า | รับ `null` | Data type | Validation / เงื่อนไข |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
  ].join('\n');
}

function mediaTypeDocumentation(
  mediaType: string,
  schema: unknown,
  document: OpenApiObject,
): MediaTypeValidationDocumentation {
  const fields: FieldValidationDocumentation[] = [];
  const rules: string[] = [];
  collectSchema(
    schema,
    {
      document,
      path: '',
      availability: 'always',
      referenceStack: new Set(),
    },
    fields,
    rules,
  );

  return {
    mediaType,
    fields,
    rules: uniqueStrings(rules),
  };
}

function requestBodyMarkdown(
  bodyRequired: boolean,
  mediaTypes: MediaTypeValidationDocumentation[],
): string {
  const sections = mediaTypes.map((mediaType) => {
    const rules =
      mediaType.rules.length > 0
        ? ['', '**เงื่อนไขร่วม/หลายฟิลด์**', '', ...mediaType.rules.map((rule) => `- ${rule}`)]
        : [];

    return [
      `#### ${inlineCode(mediaType.mediaType)}`,
      '',
      mediaType.fields.length > 0
        ? validationTable(mediaType.fields)
        : 'Schema นี้ไม่มี field ย่อยที่ต้องกรอก',
      ...rules,
    ].join('\n');
  });

  return [
    '### Validation ของ Request body',
    '',
    `Request body: **${bodyRequired ? 'บังคับ' : 'ไม่บังคับ'}**`,
    '',
    ...sections,
  ].join('\n');
}

function appendDescription(current: unknown, addition: string): string {
  return [typeof current === 'string' ? current.trim() : '', addition].filter(Boolean).join('\n\n');
}

export function decorateWriteRequestValidationDocs(
  paths: Record<string, OpenApiObject>,
  components: OpenApiObject,
): Record<string, OpenApiObject> {
  const document: OpenApiObject = { paths, components };

  return Object.fromEntries(
    Object.entries(paths).map(([path, pathItem]) => [
      path,
      Object.fromEntries(
        Object.entries(pathItem).map(([key, value]) => {
          if (!writeMethods.has(key) || !isObject(value)) return [key, value];

          const operation = value;
          if (!isObject(operation.requestBody)) {
            return [
              key,
              {
                ...operation,
                description: appendDescription(
                  operation.description,
                  '### Validation ของ Request body\n\nOperation นี้ไม่รับ request body',
                ),
                'x-poms-request-validation': {
                  bodyRequired: false,
                  mediaTypes: [],
                },
              },
            ];
          }

          const requestBody = operation.requestBody;
          const content = isObject(requestBody.content) ? requestBody.content : {};
          const mediaTypes = Object.entries(content)
            .filter(([, mediaType]) => isObject(mediaType) && mediaType.schema !== undefined)
            .map(([mediaTypeName, mediaType]) =>
              mediaTypeDocumentation(mediaTypeName, (mediaType as OpenApiObject).schema, document),
            );
          const bodyRequired = requestBody.required === true;

          return [
            key,
            {
              ...operation,
              requestBody: {
                ...requestBody,
                description: appendDescription(
                  requestBody.description,
                  requestBodyMarkdown(bodyRequired, mediaTypes),
                ),
                'x-poms-request-validation': {
                  bodyRequired,
                  mediaTypes,
                },
              },
            },
          ];
        }),
      ),
    ]),
  );
}
