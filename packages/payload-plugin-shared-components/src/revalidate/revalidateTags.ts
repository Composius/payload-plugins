import { TAG_MAX_LENGTH } from './tags.js'

/**
 * `revalidateTag`'s second argument: the name of a `cacheLife` profile, or an
 * inline `{ expire }` in seconds. Declared here instead of imported from
 * `next/cache`, so the published type definitions stay free of Next.
 */
export type RevalidateProfile = { expire?: number } | string

type RevalidateTag = (tag: string, profile: RevalidateProfile) => void

/**
 * Resolved once per process. `next` is an optional peer dependency: away from a
 * Next.js app — a migration, a seeding script, a unit test — the import fails
 * and every revalidation quietly becomes a no-op.
 */
let loading: Promise<RevalidateTag | undefined> | undefined

const loadRevalidateTag = (): Promise<RevalidateTag | undefined> => {
  // `next/cache.js`, not `next/cache`: Next.js ships no `exports` map, and its
  // `types` field sends the bare specifier looking for `next/cache/index.d.ts`
  // under `moduleResolution: nodenext`. The extension resolves to the same file
  // for Node and for every bundler, and to its declarations for TypeScript.
  loading ??= import('next/cache.js')
    .then((mod): RevalidateTag => mod.revalidateTag)
    .catch(() => undefined)

  return loading
}

/** Drops the memoized `next/cache` lookup. Exists for tests. */
export const resetRevalidateTagsCache = (): void => {
  loading = undefined
}

export type RevalidateTagsResult = {
  /** Set when the call failed. The tags were then left untouched. */
  error?: unknown
  /** The tags actually invalidated, deduplicated. */
  tags: string[]
}

/**
 * Invalidates `tags`, skipping the empty and the over-long ones. Never throws:
 * a Payload `afterChange` hook runs inside the write's transaction, so an
 * unreachable cache must not be allowed to roll the write back.
 */
export const revalidateTags = async (
  tags: string[],
  profile: RevalidateProfile,
): Promise<RevalidateTagsResult> => {
  const revalidateTag = await loadRevalidateTag()
  const unique = [...new Set(tags.filter((tag) => tag.length > 0 && tag.length <= TAG_MAX_LENGTH))]

  if (!revalidateTag || unique.length === 0) {
    return { tags: [] }
  }

  try {
    for (const tag of unique) {
      revalidateTag(tag, profile)
    }
  } catch (error) {
    // Every tag in a call shares one request scope, so the first failure is the
    // only informative one — the rest would repeat it verbatim.
    return { error, tags: [] }
  }

  return { tags: unique }
}
