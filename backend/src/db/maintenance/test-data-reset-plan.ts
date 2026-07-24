export interface ForeignKeyEdge {
  parentTable: string;
  childTable: string;
}

const PARAMETER_INTERVALS = new Set(['real', '1m', '5m', '60m', '1day', 'test']);
const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function buildDeletePlan(roots: string[], edges: ForeignKeyEdge[]): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const edge of edges) {
    const children = childrenByParent.get(edge.parentTable) ?? [];
    if (!children.includes(edge.childTable)) children.push(edge.childTable);
    childrenByParent.set(edge.parentTable, children);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const plan: string[] = [];

  const visit = (table: string): void => {
    if (visiting.has(table)) {
      throw new Error(`Foreign-key cycle detected at ${table}`);
    }
    if (visited.has(table)) return;

    visiting.add(table);
    for (const child of childrenByParent.get(table) ?? []) visit(child);
    visiting.delete(table);
    visited.add(table);
    plan.push(table);
  };

  for (const root of roots) visit(root);
  return plan;
}

export function findParameterTables(stationIds: string[], tableNames: string[]): string[] {
  const stationSet = new Set(stationIds.filter(Boolean));
  return tableNames
    .filter((tableName) => {
      const markerIndex = tableName.lastIndexOf('_data_');
      if (markerIndex <= 0) return false;
      const stationId = tableName.slice(0, markerIndex);
      const interval = tableName.slice(markerIndex + '_data_'.length);
      return stationSet.has(stationId) && PARAMETER_INTERVALS.has(interval);
    })
    .sort();
}

export function quoteSqlIdentifier(identifier: string): string {
  if (!SAFE_IDENTIFIER.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `[${identifier}]`;
}
