import type { Access, CollectionSlug, Endpoint, PayloadRequest } from 'payload'

import type { RedirectionMatchType, RedirectionRule, RedirectionRulesResponse } from '../types.js'

import { DEFAULT_MAX_AGE, DEFAULT_MAX_RULES, RULES_PATH, RULES_VERSION, STATUSES } from '../constants.js'
import { compileRegex } from '../lib/paths.js'
import { validateDestination, validateSource } from '../lib/validation.js'

export type RedirectionsEndpointOptions = {
  /**
   * Guards the endpoint. Defaults to allowing anyone — an edge proxy carries no
   * Payload session. Combine with `token` to keep the URL map private.
   */
  access?: Access
  /**
   * `Cache-Control` lifetime in seconds:
   * `public, s-maxage=<maxAge>, stale-while-revalidate=<maxAge * 10>`.
   * `0` sends `no-store`. Ignored when `token` is set — a tokenized rule list is
   * always `private, no-store`.
   * @default 60
   */
  maxAge?: number
  /**
   * Hard cap on the number of rules returned, so the response stays cheap even
   * if the collection grows unbounded.
   * @default 2000
   */
  maxRules?: number
  /**
   * Path within the collection route, so the public URL is `/api/<slug><path>`.
   * @default '/rules'
   */
  path?: string
  /**
   * When set, the endpoint requires the same value in an `x-redirections-token`
   * header (or `Authorization: Bearer <token>`). Pass it to
   * `createRedirectionsProxy({ token })` as well.
   */
  token?: string
}

type RedirectionDoc = {
  from?: string
  matchType?: RedirectionMatchType
  preserveQuery?: boolean
  status?: number | string
  to?: string
  updatedAt?: string
}

const json = (body: unknown, status: number, headers: Record<string, string> = {}): Response =>
  Response.json(body, { headers: { 'Cache-Control': 'no-store', ...headers }, status })

const presentedToken = (req: PayloadRequest): string | undefined => {
  const header = req.headers.get('x-redirections-token')
  if (header) {
    return header
  }

  const authorization = req.headers.get('authorization')

  return authorization?.toLowerCase().startsWith('bearer ')
    ? authorization.slice('bearer '.length)
    : undefined
}

/**
 * Compares two secrets without an early exit on the first differing byte. Not
 * a hardened constant-time primitive (JS strings make that impossible), but it
 * removes the trivial timing signal.
 */
const secretsMatch = (expected: string, actual: string | undefined): boolean => {
  if (actual === undefined || actual.length !== expected.length) {
    return false
  }

  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i)
  }

  return diff === 0
}

const toRule = (doc: RedirectionDoc): RedirectionRule | undefined => {
  const { from, matchType, to } = doc
  if (!from || !to || !matchType) {
    return undefined
  }

  // Defense in depth: a rule written before these validations existed, or
  // through a direct database write, must not break the whole list.
  if (validateSource(from, matchType) || validateDestination(to)) {
    return undefined
  }

  if (matchType === 'regex' && !compileRegex(from)) {
    return undefined
  }

  const status = Number(doc.status)

  return {
    from,
    matchType,
    preserveQuery: doc.preserveQuery !== false,
    status: (STATUSES as readonly number[]).includes(status)
      ? (status as RedirectionRule['status'])
      : 301,
    to,
  }
}

/**
 * Builds the `GET /api/<slug>/rules` endpoint: the compact, cacheable rule list
 * the Next proxy helper consumes.
 */
export const rulesEndpoint = (
  slug: string,
  options: RedirectionsEndpointOptions = {},
): Endpoint => {
  const maxAge = options.maxAge ?? DEFAULT_MAX_AGE
  const maxRules = options.maxRules ?? DEFAULT_MAX_RULES
  const { access, token } = options

  return {
    handler: async (req) => {
      if (token && !secretsMatch(token, presentedToken(req))) {
        return json({ message: 'Unauthorized' }, 401)
      }

      if (access && !(await access({ req }))) {
        return json({ message: 'Forbidden' }, 403)
      }

      const { docs } = await req.payload.find({
        collection: slug as CollectionSlug,
        depth: 0,
        limit: maxRules,
        overrideAccess: true,
        pagination: false,
        req,
        select: {
          from: true,
          matchType: true,
          preserveQuery: true,
          status: true,
          to: true,
          updatedAt: true,
        },
        // Rows written before `enabled` existed have no value; only an explicit
        // `false` should exclude a rule.
        where: { enabled: { not_equals: false } },
        // The documented tie-break within each match type.
        sort: ['-priority', 'createdAt'],
      })

      const candidates = docs as RedirectionDoc[]
      const rules: RedirectionRule[] = []
      let skipped = 0
      let updatedAt: null | string = null

      for (const doc of candidates) {
        const rule = toRule(doc)
        if (!rule) {
          skipped++
          continue
        }

        rules.push(rule)
        if (doc.updatedAt && (!updatedAt || doc.updatedAt > updatedAt)) {
          updatedAt = doc.updatedAt
        }
      }

      if (skipped > 0) {
        req.payload.logger.warn(
          `[redirections] skipped ${skipped} unusable rule(s) in "${slug}" — check their path and destination`,
        )
      }

      const etag = `W/"${RULES_VERSION}-${rules.length}-${updatedAt ?? 'empty'}"`

      const cacheControl =
        token || maxAge <= 0
          ? `${token ? 'private, ' : ''}no-store`
          : `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 10}`

      if (req.headers.get('if-none-match') === etag) {
        return new Response(null, {
          headers: { 'Cache-Control': cacheControl, ETag: etag },
          status: 304,
        })
      }

      const body: RedirectionRulesResponse = {
        count: rules.length,
        rules,
        updatedAt,
        version: RULES_VERSION,
      }

      return json(body, 200, { 'Cache-Control': cacheControl, ETag: etag })
    },
    method: 'get',
    path: options.path ?? RULES_PATH,
  }
}
