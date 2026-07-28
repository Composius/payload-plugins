/**
 * Cache tags are the contract between Payload and the front end: the hooks in
 * `./hooks.ts` invalidate them with `revalidateTag`, and a `'use cache'`
 * function claims the same strings with `cacheTag`. Both sides build them from
 * these helpers so the two can never drift apart.
 *
 * This module imports nothing — not `payload`, not `next` — so a plugin can
 * re-export it from a front-end entry point without dragging the CMS into the
 * page bundle.
 */

/** Longest tag Next.js accepts. Longer ones are dropped rather than sent. */
export const TAG_MAX_LENGTH = 256

/**
 * Covers every document of a collection: lists, archives, counts, sitemaps.
 * Any create, update or delete in the collection invalidates it.
 */
export const collectionTag = (collection: string): string => collection

/** Covers the single document with this id. */
export const idTag = (collection: string, id: number | string): string =>
  `${collection}:id:${id}`

/**
 * Covers the single document reachable through `field` — the `slug` of an
 * article, the `name` of a menu — which is how a front-end route usually
 * addresses it, having never seen the id.
 */
export const fieldTag = (collection: string, field: string, value: string): string =>
  `${collection}:${field}:${value}`
