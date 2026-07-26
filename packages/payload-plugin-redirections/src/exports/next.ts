/**
 * Next.js entry point. Imports nothing from `payload` or `next`, so it loads on
 * both the edge and Node runtimes.
 */

export {
  DEFAULT_RULES_ENDPOINT,
  DEFAULT_SLUG,
  DEFAULT_STATUS,
  MATCH_TYPES,
  RULES_ENDPOINT_PATH,
  RULES_PATH,
  RULES_VERSION,
  STATUSES,
} from '../constants.js'
export { isAbsoluteUrl, normalizePath, normalizeSearch } from '../lib/paths.js'
export { resolveRedirection } from '../lib/resolver.js'
export type { ResolveOptions } from '../lib/resolver.js'
export { clearRedirectionsCache, getRedirectionRules } from '../next/cache.js'
export type { RedirectionRulesSource } from '../next/cache.js'
export { createRedirectionsProxy } from '../next/proxy.js'
export type {
  RedirectionsProxyEvent,
  RedirectionsProxyOptions,
  RedirectionsProxyRequest,
} from '../next/proxy.js'
export type {
  RedirectionMatchType,
  RedirectionRule,
  RedirectionRulesResponse,
  RedirectionStatus,
  ResolvedRedirection,
} from '../types.js'
