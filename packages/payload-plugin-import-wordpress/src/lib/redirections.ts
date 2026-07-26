import type { Payload } from 'payload'

import type { RedirectionStatus } from '../types.js'

import { countDocs, createDoc } from './payloadOps.js'

/** A permalink that was imported, with the slug its article ended up on. */
export type ImportedPermalink = {
  /** Path of the old WordPress permalink, e.g. `/blog/hello-world`. */
  path: string
  slug: string
}

export type PlannedRule = {
  /** How many imported permalinks this rule covers. */
  covers: number
  from: string
  matchType: 'exact' | 'prefix'
  to: string
}

/** Canonical path form: leading slash, no repeated slashes, no trailing slash. */
export const normalizePath = (input: string): string => {
  let path = input.split('#')[0].split('?')[0]
  if (!path.startsWith('/')) {
    path = `/${path}`
  }
  path = path.replace(/\/{2,}/g, '/')
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
}

/** Everything before the last segment of a path (`/blog/a/b` → `/blog/a`). */
const parentOf = (path: string): string => {
  const normalized = normalizePath(path)
  const at = normalized.lastIndexOf('/')
  return at <= 0 ? '/' : normalized.slice(0, at)
}

/** Last segment of a path (`/blog/a/b` → `b`). */
const lastSegment = (path: string): string => {
  const normalized = normalizePath(path)
  return normalized.slice(normalized.lastIndexOf('/') + 1)
}

const SLUG_TOKEN = '__wp_import_slug__'

/**
 * Derives the destination base for prefix rules from `articleUrl` — the part
 * before the slug, without its trailing slash (`/articles`). A prefix rule
 * appends the leftover path segments to its destination, so a URL builder that
 * puts anything *after* the slug can't be expressed as one; those fall back to
 * exact rules and this returns `null`.
 */
export const deriveArticleBase = (articleUrl: (slug?: null | string) => string): null | string => {
  const probe = articleUrl(SLUG_TOKEN)
  const at = probe.indexOf(SLUG_TOKEN)
  if (at === -1 || probe.slice(at + SLUG_TOKEN.length) !== '') {
    return null
  }
  const base = probe.slice(0, at)
  return base.length > 1 && base.endsWith('/') ? base.slice(0, -1) : base
}

export type PlanRulesArgs = {
  articleBase: null | string
  articleUrl: (slug?: null | string) => string
  permalinks: ImportedPermalink[]
  strategy: 'exact' | 'prefix'
}

/**
 * Turns imported permalinks into the smallest set of redirection rules.
 *
 * With the `prefix` strategy, permalinks whose last segment is the article slug
 * are grouped by their folder into a single prefix rule — `/blog/a` and
 * `/blog/b` become one `/blog` → `/articles` rule, since the redirections
 * resolver appends the leftover segments. Two cases fall back to an exact rule:
 * a slug that changed during the import (the folder mapping wouldn't hold), and
 * a permalink sitting at the site root (a prefix rule on `/` would swallow
 * every URL on the site). Self-referencing rules are dropped.
 */
export const planRedirectionRules = ({
  articleBase,
  articleUrl,
  permalinks,
  strategy,
}: PlanRulesArgs): PlannedRule[] => {
  const prefixes = new Map<string, number>()
  const exact = new Map<string, PlannedRule>()

  const addExact = ({ path, slug }: ImportedPermalink): void => {
    const from = normalizePath(path)
    const to = articleUrl(slug)
    // A rule pointing at its own source would be rejected on save.
    if (normalizePath(to) === from && !/^[a-z][a-z\d+.-]*:\/\//i.test(to)) {
      return
    }
    if (!exact.has(from)) {
      exact.set(from, { covers: 1, from, matchType: 'exact', to })
      return
    }
    exact.get(from)!.covers += 1
  }

  for (const permalink of permalinks) {
    const path = normalizePath(permalink.path)
    const canPrefix =
      strategy === 'prefix' &&
      articleBase !== null &&
      permalink.slug &&
      lastSegment(path) === permalink.slug &&
      parentOf(path) !== '/'

    if (!canPrefix) {
      addExact(permalink)
      continue
    }

    const parent = parentOf(path)
    // The folder already *is* the destination — nothing to redirect.
    if (parent === normalizePath(articleBase!)) {
      continue
    }
    prefixes.set(parent, (prefixes.get(parent) ?? 0) + 1)
  }

  return [
    ...Array.from(prefixes, ([from, covers]): PlannedRule => ({
      covers,
      from,
      matchType: 'prefix',
      to: articleBase!,
    })),
    ...exact.values(),
  ]
}

export type CreateRulesArgs = {
  rules: PlannedRule[]
  slug: string
  status: RedirectionStatus
}

/**
 * Persists planned rules, skipping any that already exist — the collection
 * carries a unique `(from, matchType)` index, so a re-run or a resume must not
 * try to insert them again. Returns the rules that were actually created.
 */
export const createRedirectionRules = async (
  payload: Payload,
  args: CreateRulesArgs,
): Promise<{ created: PlannedRule[]; errors: Array<{ message: string; rule: PlannedRule }> }> => {
  const created: PlannedRule[] = []
  const errors: Array<{ message: string; rule: PlannedRule }> = []

  if (!payload.collections[args.slug as never]) {
    return { created, errors }
  }

  for (const rule of args.rules) {
    try {
      const { totalDocs } = await countDocs(payload, {
        collection: args.slug,
        where: {
          and: [{ from: { equals: rule.from } }, { matchType: { equals: rule.matchType } }],
        },
      })
      if (totalDocs > 0) {
        continue
      }

      await createDoc(payload, {
        collection: args.slug,
        data: {
          from: rule.from,
          matchType: rule.matchType,
          status: args.status,
          to: rule.to,
        },
      })
      created.push(rule)
    } catch (error) {
      errors.push({
        message: error instanceof Error ? error.message : String(error),
        rule,
      })
    }
  }

  return { created, errors }
}
