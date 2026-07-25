/**
 * Normalizes an id for use as a relationship/upload value. Import records store
 * ids as text, but numeric-id database adapters (e.g. SQLite/Postgres) reject a
 * stringified number in relationship validation — so coerce all-digit strings
 * back to numbers.
 */
export const coerceId = (id: number | string): number | string =>
  typeof id === 'number' ? id : /^\d+$/.test(id) ? Number(id) : id
