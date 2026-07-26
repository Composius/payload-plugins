/**
 * URL string helpers shared by the resolver, the field validators and the Next
 * proxy. Deliberately dependency-free: this module ends up in the `/next`
 * bundle, which has to run on the edge runtime.
 */

const REGEX_CACHE_LIMIT = 1000

const regexCache = new Map<string, null | RegExp>()

/**
 * Compiles a rule's regex source, memoized across calls. Returns `null` for an
 * invalid pattern instead of throwing, so a bad rule can never take down a
 * request — callers skip it.
 */
export const compileRegex = (source: string): null | RegExp => {
  const cached = regexCache.get(source)
  if (cached !== undefined) {
    return cached
  }

  let compiled: null | RegExp = null
  try {
    compiled = new RegExp(source)
  } catch {
    compiled = null
  }

  // Rule sources are bounded in practice, but the cache is module-global and
  // long-lived — reset rather than grow without limit.
  if (regexCache.size >= REGEX_CACHE_LIMIT) {
    regexCache.clear()
  }
  regexCache.set(source, compiled)

  return compiled
}

/** Empties the regex cache. Exported for tests. */
export const clearRegexCache = (): void => {
  regexCache.clear()
}

/**
 * Canonical form used on both sides of a match: no query or hash, a leading
 * slash, no repeated slashes, and no trailing slash (except for the root).
 */
export const normalizePath = (input: string): string => {
  let path = input.split('#')[0]!.split('?')[0]!

  if (!path.startsWith('/')) {
    path = `/${path}`
  }

  path = path.replace(/\/{2,}/g, '/')

  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1)
  }

  return path
}

/** Normalizes a search string to either `''` or `?…`. */
export const normalizeSearch = (search: string): string => {
  if (!search || search === '?') {
    return ''
  }

  return search.startsWith('?') ? search : `?${search}`
}

/** True for `scheme://host…` and protocol-relative `//host…` destinations. */
export const isAbsoluteUrl = (value: string): boolean =>
  value.startsWith('//') || /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value)

/** Splits a destination into its path, `?query` and `#hash` parts. */
export const splitDestination = (to: string): { base: string; hash: string; query: string } => {
  const hashAt = to.indexOf('#')
  const hash = hashAt === -1 ? '' : to.slice(hashAt)
  const rest = hashAt === -1 ? to : to.slice(0, hashAt)
  const queryAt = rest.indexOf('?')

  return {
    base: queryAt === -1 ? rest : rest.slice(0, queryAt),
    hash,
    query: queryAt === -1 ? '' : rest.slice(queryAt),
  }
}

/**
 * Appends a prefix rule's leftover path segments to a destination, keeping any
 * `?query` and `#hash` the destination already carries.
 */
export const appendRemainder = (to: string, remainder: string): string => {
  if (!remainder || remainder === '/') {
    return to
  }

  const { base, hash, query } = splitDestination(to)
  const trimmed = base.length > 1 && base.endsWith('/') ? base.slice(0, -1) : base
  const suffix = remainder.startsWith('/') ? remainder : `/${remainder}`

  return `${trimmed === '/' ? '' : trimmed}${suffix}${query}${hash}`
}

/**
 * Substitutes regex captures into a destination: `$1`–`$99` for groups, `$&`
 * for the whole match, `$$` for a literal `$`. A group that did not
 * participate resolves to an empty string.
 */
export const applyCaptures = (to: string, match: RegExpExecArray): string =>
  to.replace(/\$(\$|&|\d{1,2})/g, (_token, group: string) => {
    if (group === '$') {
      return '$'
    }
    if (group === '&') {
      return match[0] ?? ''
    }
    return match[Number(group)] ?? ''
  })
