/**
 * Wire and resolver types. This module must stay free of `payload` and `next`
 * imports: it is bundled into the `/next` entry, which has to load on the edge
 * runtime.
 */

export type RedirectionMatchType = 'exact' | 'prefix' | 'regex'

export type RedirectionStatus = 301 | 302 | 307 | 308

/** One redirection as published by the rules endpoint and consumed by the resolver. */
export type RedirectionRule = {
  /** Pathname, prefix, or regular expression source, depending on `matchType`. */
  from: string
  matchType: RedirectionMatchType
  /**
   * Forwards the incoming query string when the destination carries none of
   * its own.
   */
  preserveQuery: boolean
  status: RedirectionStatus
  /** Absolute URL or root-relative path. Supports `$1`/`$&` for regex rules. */
  to: string
}

/** Body returned by `GET /api/plugin-redirections/rules`. */
export type RedirectionRulesResponse = {
  count: number
  rules: RedirectionRule[]
  /** Most recent `updatedAt` across the returned rules — drives the ETag. */
  updatedAt: null | string
  version: number
}

export type ResolvedRedirection = {
  /** The rule that produced this result. */
  rule: RedirectionRule
  status: RedirectionStatus
  /** Absolute URL or root-relative path, query already applied. */
  to: string
}
