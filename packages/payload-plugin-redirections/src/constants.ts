import type { RedirectionMatchType, RedirectionStatus } from './types.js'

/**
 * Shared defaults. Like `types.ts`, this module is bundled into the `/next`
 * entry and must not import `payload` or `next`.
 */

/** Bumped whenever the rules payload shape changes; the proxy refuses others. */
export const RULES_VERSION = 1

export const DEFAULT_SLUG = 'redirections'

/**
 * Path of the rules endpoint *within* the collection route. Payload resolves
 * `/api/<slug>/...` against the collection's own endpoints, and user endpoints
 * are matched before the built-in `/:id` route, so `/rules` never collides with
 * a document id.
 */
export const RULES_PATH = '/rules'

/** API-relative path of the rules endpoint with the default slug. */
export const RULES_ENDPOINT_PATH = `/${DEFAULT_SLUG}${RULES_PATH}`

/** What the Next helper fetches when no `endpoint` is configured. */
export const DEFAULT_RULES_ENDPOINT = `/api${RULES_ENDPOINT_PATH}`

export const TOKEN_HEADER = 'x-redirections-token'

export const SOURCE_HEADER = 'x-redirection-source'

export const MATCH_TYPES: readonly RedirectionMatchType[] = ['exact', 'prefix', 'regex']

export const STATUSES: readonly RedirectionStatus[] = [301, 302, 307, 308]

/**
 * Default status for a new rule. 307 preserves the request method and body,
 * and — unlike 301/308 — is not cached indefinitely by browsers, so a rule
 * fixed after the fact actually takes effect.
 */
export const DEFAULT_STATUS: RedirectionStatus = 307

/** Endpoint: `Cache-Control` max age in seconds. */
export const DEFAULT_MAX_AGE = 60

/** Endpoint: hard cap on the number of rules returned. */
export const DEFAULT_MAX_RULES = 2000

/** Next helper: seconds the fetched rules stay fresh in module memory. */
export const DEFAULT_TTL = 60

/** Next helper: extra seconds a stale list keeps being served while refreshes fail. */
export const DEFAULT_STALE_TTL = 600

/** Next helper: seconds before retrying after a failed fetch. */
export const DEFAULT_RETRY_TTL = 10

/** Next helper: milliseconds before the rules fetch is aborted. */
export const DEFAULT_TIMEOUT = 2000

/** Next helper: port the loopback fallback assumes when `PORT` is unset — Next's own default. */
export const DEFAULT_PORT = '3000'
