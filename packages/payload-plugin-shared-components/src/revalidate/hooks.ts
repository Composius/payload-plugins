import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, PayloadRequest } from 'payload'

import type { RevalidateProfile } from './revalidateTags.js'

import { revalidateTags } from './revalidateTags.js'
import { collectionTag, fieldTag, idTag } from './tags.js'

export type RevalidateEvent = {
  /** Slug of the collection the hook is attached to. */
  collection: string
  doc: Record<string, unknown>
  operation: 'create' | 'delete' | 'update'
  /** The document as it stood before the change. Absent on create and delete. */
  previousDoc?: Record<string, unknown>
}

export type RevalidateOptions = {
  /**
   * Called instead of the default log whenever a revalidation fails, which
   * mostly means it ran outside a Next.js request. The write itself has already
   * succeeded either way; only the cache still points at the old value.
   */
  onError?: (error: unknown, event: RevalidateEvent) => void
  /**
   * `revalidateTag`'s second argument: a `cacheLife` profile name such as
   * `'max'`, or an inline `{ expire }` in seconds.
   *
   * Defaults to `{ expire: 0 }` — the tag expires at once, so the first visitor
   * after a save waits for a fresh render and sees the change. `'max'` trades
   * that for stale-while-revalidate: nobody waits, but the visitor right after
   * a save (usually the editor checking their own work) is served the old page
   * while the new one is built in the background.
   *
   * `updateTag`, which would give read-your-writes without the wait, is not an
   * option here: it only works inside a Server Action, and these hooks run in
   * the Payload route handler.
   *
   * @default { expire: 0 }
   */
  profile?: RevalidateProfile
  /**
   * Extra tags invalidated alongside the built-in ones — a sitemap, an RSS
   * feed, a home page listing the latest documents.
   */
  tags?: (event: RevalidateEvent) => string[]
}

export type RevalidateCollection = {
  /** Slug of the collection, and the root of every tag built for it. */
  collection: string
  /**
   * Set when the collection has drafts enabled, so draft-only saves are
   * skipped: nothing about them is public.
   */
  drafts?: boolean
  /**
   * Fields that address a single document on the front end, beyond its id.
   * `['slug']` covers the usual `/articles/[slug]` route.
   */
  fields?: string[]
  /**
   * Collection tags invalidated alongside this collection's own, for documents
   * that are embedded elsewhere — a renamed category shows up on every article
   * that carries it.
   */
  related?: string[]
}

/** Immediate expiry: the change is visible on the very next request. */
const DEFAULT_PROFILE: RevalidateProfile = { expire: 0 }

const isPublished = (doc?: Record<string, unknown>): boolean => doc?._status === 'published'

const documentTags = (
  { collection, fields = [] }: RevalidateCollection,
  doc: Record<string, unknown>,
): string[] => {
  const tags: string[] = []
  const id = doc.id

  if (typeof id === 'number' || typeof id === 'string') {
    tags.push(idTag(collection, id))
  }

  for (const field of fields) {
    const value = doc[field]

    if (typeof value === 'string' && value.length > 0) {
      tags.push(fieldTag(collection, field, value))
    }
  }

  return tags
}

const revalidate = async (
  target: RevalidateCollection,
  options: RevalidateOptions,
  event: RevalidateEvent,
  req: PayloadRequest,
): Promise<void> => {
  const { error, tags } = await revalidateTags(
    [
      collectionTag(target.collection),
      ...(target.related ?? []).map(collectionTag),
      ...documentTags(target, event.doc),
      // The document may have just been renamed, which leaves the page cached
      // under its former slug behind. It has no route anymore, but it does have
      // an entry, and a slug that comes back later would resurrect the old one.
      ...(event.previousDoc ? documentTags(target, event.previousDoc) : []),
      ...(options.tags?.(event) ?? []),
    ],
    options.profile ?? DEFAULT_PROFILE,
  )

  if (error) {
    if (options.onError) {
      options.onError(error, event)
      return
    }

    // Debug rather than warn: running away from a Next.js request is routine
    // (seeds, migrations, scripts), and there is nothing to revalidate there.
    req.payload.logger.debug({
      err: error,
      msg: `Skipped cache revalidation for ${event.collection}`,
    })

    return
  }

  if (tags.length > 0) {
    req.payload.logger.debug(`Revalidated cache tags: ${tags.join(', ')}`)
  }
}

export const revalidateAfterChange = (
  target: RevalidateCollection,
  options: RevalidateOptions = {},
): CollectionAfterChangeHook =>
  async ({ context, doc, operation, previousDoc, req }) => {
    if (context.disableRevalidate) {
      return doc
    }

    // Autosave writes a draft every few seconds, and none of it is public: a
    // document that is neither published nor freshly unpublished has nothing to
    // invalidate. The one save this lets through needlessly is the first draft
    // edit of a published document — one wasted invalidation per editing
    // session, the price of keeping unpublish correct.
    if (target.drafts && !isPublished(doc) && !isPublished(previousDoc)) {
      return doc
    }

    await revalidate(
      target,
      options,
      { collection: target.collection, doc, operation, previousDoc },
      req,
    )

    return doc
  }

export const revalidateAfterDelete = (
  target: RevalidateCollection,
  options: RevalidateOptions = {},
): CollectionAfterDeleteHook =>
  async ({ context, doc, req }) => {
    if (context.disableRevalidate) {
      return doc
    }

    // Unconditional, drafts included: deletes are rare, and a document deleted
    // straight after being unpublished still has a cached page to clear.
    await revalidate(target, options, { collection: target.collection, doc, operation: 'delete' }, req)

    return doc
  }

/**
 * The `afterChange` and `afterDelete` hooks a collection needs to keep a
 * Next.js cache in step with it, ready to spread into its `hooks` block.
 * Returns nothing when revalidation is turned off.
 */
export const revalidateHooks = (
  target: RevalidateCollection,
  options: false | RevalidateOptions,
): {
  afterChange?: CollectionAfterChangeHook[]
  afterDelete?: CollectionAfterDeleteHook[]
} =>
  options === false
    ? {}
    : {
        afterChange: [revalidateAfterChange(target, options)],
        afterDelete: [revalidateAfterDelete(target, options)],
      }
