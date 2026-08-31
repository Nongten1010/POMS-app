export function isMssqlUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as {
    number?: unknown;
    originalError?: { number?: unknown; info?: { number?: unknown } };
  };
  const number = Number(
    candidate.number ?? candidate.originalError?.number ?? candidate.originalError?.info?.number,
  );
  return number === 2601 || number === 2627;
}
