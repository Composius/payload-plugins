import type { Payload } from 'payload'

import crypto from 'crypto'

import type { AuthorStrategy, ImportedItem } from '../types.js'
import type { ImageImportResult } from './media.js'
import type { WPUser } from './wpTypes.js'

import { coerceId } from './id.js'
import { decodeEntities } from './url.js'
import { importImage } from './media.js'
import { createDoc, findDocs } from './payloadOps.js'
import { findDoneRecord, saveRecord } from './records.js'

export type ResolvedAuthor = {
  /** Article relationship field to assign (`editor` for users, `author` for authors). */
  field: 'author' | 'editor'
  value: number | string
}

export type ResolveAuthorArgs = {
  authorsSlug: string
  defaultUserId?: number | string
  dryRun: boolean
  fetchImpl?: typeof fetch
  imageCache: Map<string, ImageImportResult>
  jobId: number | string
  mediaSlug: string
  site: string
  strategy: AuthorStrategy
  /** Domain for synthesized emails, or `false` to skip users without a real email. */
  syntheticEmailDomain: false | string
  timeoutMs: number
  usersSlug: string
  wpUser?: WPUser
}

/** Highest-resolution avatar URL WordPress exposes, if any. */
const avatarUrl = (wpUser: WPUser): string | undefined => {
  const urls = wpUser.avatar_urls
  if (!urls) {
    return undefined
  }
  const sizes = Object.keys(urls)
    .map(Number)
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => b - a)
  return sizes.length ? urls[String(sizes[0])] : undefined
}

export type ResolveAuthorResult = {
  author: null | ResolvedAuthor
  imported?: ImportedItem
  /** Set when a `users`-strategy author had no email and creation was skipped. */
  skippedNoEmail?: { name: string; sourceId: number }
}

/**
 * Resolves the article author relationship for a post per the configured
 * strategy, importing into `users` (default) or `authors`, or using a fixed
 * user. Idempotent via import records. Returns the imported item (if any new
 * doc was created) alongside the resolved relationship.
 */
export const resolveAuthor = async (
  payload: Payload,
  args: ResolveAuthorArgs,
): Promise<ResolveAuthorResult> => {
  if (args.strategy === 'fixed') {
    return {
      author: args.defaultUserId != null ? { field: 'editor', value: args.defaultUserId } : null,
    }
  }

  const wpUser = args.wpUser
  if (!wpUser) {
    return { author: args.defaultUserId != null ? { field: 'editor', value: args.defaultUserId } : null }
  }

  const name = decodeEntities(wpUser.name ?? wpUser.slug ?? `author-${wpUser.id}`)

  const existing = await findDoneRecord(payload, {
    site: args.site,
    sourceId: wpUser.id,
    sourceType: 'author',
  })

  if (args.strategy === 'users') {
    const field = 'editor' as const
    if (existing) {
      return { author: { field, value: existing } }
    }
    // The public REST API rarely exposes emails; synthesize one from the
    // configured domain, or skip user creation when that is disabled.
    const email =
      wpUser.email ||
      (args.syntheticEmailDomain
        ? `${wpUser.slug || `author-${wpUser.id}`}@${args.syntheticEmailDomain}`
        : null)

    if (!email) {
      return {
        author: args.defaultUserId != null ? { field, value: args.defaultUserId } : null,
        skippedNoEmail: { name, sourceId: wpUser.id },
      }
    }

    if (args.dryRun) {
      return { author: null, imported: { sourceId: wpUser.id, targetId: 'dry-run', title: name } }
    }

    // Reuse an existing user with the same email if present.
    const { docs } = await findDocs(payload, {
      collection: args.usersSlug,
      where: { email: { equals: email } },
      limit: 1,
      depth: 0,
    })
    let userId = docs[0]?.id as number | string | undefined

    if (!userId) {
      const created = await createDoc(payload, {
        collection: args.usersSlug,
        data: {
          email,
          name,
          password: crypto.randomBytes(18).toString('hex'),
        },
      })
      userId = created.id
    }

    await saveRecord(payload, {
      jobId: args.jobId,
      site: args.site,
      sourceId: wpUser.id,
      sourceType: 'author',
      targetCollection: args.usersSlug,
      targetId: userId,
    })
    return {
      author: { field, value: userId },
      imported: { sourceId: wpUser.id, targetId: userId, title: name },
    }
  }

  // strategy === 'authors'
  const field = 'author' as const
  if (existing) {
    return { author: { field, value: existing } }
  }
  if (args.dryRun) {
    return { author: null, imported: { sourceId: wpUser.id, targetId: 'dry-run', title: name } }
  }

  const avatar = avatarUrl(wpUser)
  let pictureId: null | string = null
  if (avatar) {
    const result = await importImage(payload, {
      cache: args.imageCache,
      dryRun: args.dryRun,
      fetchImpl: args.fetchImpl,
      jobId: args.jobId,
      mediaSlug: args.mediaSlug,
      site: args.site,
      timeoutMs: args.timeoutMs,
      url: avatar,
    })
    pictureId = result.mediaId
  }

  const created = await createDoc(payload, {
    collection: args.authorsSlug,
    data: {
      name,
      ...(pictureId ? { picture: coerceId(pictureId) } : {}),
      ...(wpUser.description ? { biography: decodeEntities(wpUser.description) } : {}),
    },
  })
  const authorId = created.id

  await saveRecord(payload, {
    jobId: args.jobId,
    site: args.site,
    sourceId: wpUser.id,
    sourceType: 'author',
    targetCollection: args.authorsSlug,
    targetId: authorId,
  })
  return {
    author: { field, value: authorId },
    imported: { sourceId: wpUser.id, targetId: authorId, title: name },
  }
}
