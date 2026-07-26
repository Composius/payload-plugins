import type { RedirectionRule, ResolvedRedirection } from '../types.js'

import {
  appendRemainder,
  applyCaptures,
  compileRegex,
  isAbsoluteUrl,
  normalizePath,
  normalizeSearch,
  splitDestination,
} from './paths.js'

export type ResolveOptions = {
  /**
   * How many chained rules to follow before answering. `1` returns the first
   * match; higher values collapse `A → B → C` into a single response. Cycles
   * always stop the walk.
   * @default 1
   */
  maxHops?: number
  /**
   * Origin of the incoming request (e.g. `https://example.com`). When given,
   * absolute destinations on the same origin also take part in self-redirect
   * detection and chain following.
   */
  origin?: string
}

type Candidate = {
  rule: RedirectionRule
  to: string
}

/**
 * Collects every rule matching `pathname`, ordered by precedence:
 * exact (list order) → prefix (longest first, list order on ties) → regex
 * (list order).
 */
const candidatesFor = (pathname: string, rules: RedirectionRule[]): Candidate[] => {
  const exact: Candidate[] = []
  const prefix: { candidate: Candidate; length: number }[] = []
  const regex: Candidate[] = []

  for (const rule of rules) {
    if (rule.matchType === 'exact') {
      if (normalizePath(rule.from) === pathname) {
        exact.push({ rule, to: rule.to })
      }
      continue
    }

    if (rule.matchType === 'prefix') {
      const from = normalizePath(rule.from)
      const isRoot = from === '/'

      // Segment-aware: '/blog' matches '/blog' and '/blog/x', never '/blogging'.
      if (!isRoot && pathname !== from && !pathname.startsWith(`${from}/`)) {
        continue
      }

      const remainder = isRoot ? pathname : pathname.slice(from.length)
      prefix.push({
        candidate: { rule, to: appendRemainder(rule.to, remainder) },
        length: isRoot ? 0 : from.length,
      })
      continue
    }

    const pattern = compileRegex(rule.from)
    if (!pattern) {
      continue
    }

    const match = pattern.exec(pathname)
    if (match) {
      regex.push({ rule, to: applyCaptures(rule.to, match) })
    }
  }

  // Array.prototype.sort is stable, so equal-length prefixes keep list order.
  prefix.sort((a, b) => b.length - a.length)

  return [...exact, ...prefix.map((entry) => entry.candidate), ...regex]
}

const withQuery = (to: string, search: string, preserveQuery: boolean | undefined): string => {
  // Omitted means "preserve" — the endpoint always sends an explicit boolean.
  if (preserveQuery === false || !search) {
    return to
  }

  const { base, hash, query } = splitDestination(to)
  if (query) {
    // The destination brings its own query: leave it alone.
    return to
  }

  return `${base}${search}${hash}`
}

/** Strips a same-origin prefix, returning `null` for a destination we cannot follow. */
const toLocal = (to: string, origin: string | undefined): null | string => {
  if (!isAbsoluteUrl(to)) {
    return to
  }

  if (!origin || !(to === origin || to.startsWith(`${origin}/`))) {
    return null
  }

  return to.slice(origin.length) || '/'
}

const isSelf = (to: string, pathname: string, search: string, origin: string | undefined): boolean => {
  const local = toLocal(to, origin)
  if (local === null) {
    return false
  }

  const { base, query } = splitDestination(local)

  return normalizePath(base) === pathname && normalizeSearch(query) === search
}

const matchOnce = (
  pathname: string,
  search: string,
  rules: RedirectionRule[],
  origin: string | undefined,
): ResolvedRedirection | undefined => {
  for (const { rule, to } of candidatesFor(pathname, rules)) {
    const destination = withQuery(to, search, rule.preserveQuery)

    // A rule resolving to the URL we are already on is skipped rather than
    // returned — a lower-precedence rule may still have a real answer.
    if (isSelf(destination, pathname, search, origin)) {
      continue
    }

    return { rule, status: rule.status, to: destination }
  }

  return undefined
}

/**
 * Resolves a redirection for `pathname`. Pure and dependency-free, so it runs
 * anywhere — the Next proxy, a route handler, an Express app, or a test.
 *
 * `rules` must arrive in the order the endpoint produced them (priority
 * descending, then `createdAt` ascending); that order is the documented
 * tie-break within each match type.
 */
export const resolveRedirection = (
  pathname: string,
  rules: RedirectionRule[],
  search = '',
  options: ResolveOptions = {},
): ResolvedRedirection | undefined => {
  if (rules.length === 0) {
    return undefined
  }

  const { origin } = options
  const maxHops = Math.max(1, options.maxHops ?? 1)

  let currentPath = normalizePath(pathname)
  let currentSearch = normalizeSearch(search)
  const seen = new Set([`${currentPath}${currentSearch}`])
  let result: ResolvedRedirection | undefined

  for (let hop = 0; hop < maxHops; hop++) {
    const next = matchOnce(currentPath, currentSearch, rules, origin)
    if (!next) {
      break
    }

    // The status always comes from the rule that matched the *incoming* URL;
    // only the destination is collapsed forward.
    result = result ? { ...result, to: next.to } : next

    if (hop + 1 >= maxHops) {
      break
    }

    const local = toLocal(next.to, origin)
    if (local === null) {
      break
    }

    const { base, query } = splitDestination(local)
    const nextPath = normalizePath(base)
    const nextSearch = normalizeSearch(query)
    const key = `${nextPath}${nextSearch}`

    if (seen.has(key)) {
      // Cycle — stop and keep the last good result.
      break
    }

    seen.add(key)
    currentPath = nextPath
    currentSearch = nextSearch
  }

  return result
}
