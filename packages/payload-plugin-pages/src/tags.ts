import { collectionTag, fieldTag, idTag } from '@composius/payload-plugin-shared-components/tags'

/**
 * The cache tags the collection hooks invalidate. Claim the matching one with
 * `cacheTag` inside a `'use cache'` function and a save in the admin panel
 * reaches the front end.
 *
 * Re-exported from `@composius/payload-plugin-pages/tags`, which pulls in
 * neither `payload` nor `next` and is the import to reach for in page code.
 */

/** Every page: navigation built from pages, sitemaps, search indexes. */
export const PAGES_TAG = collectionTag('pages')

/** One page, addressed the way a `/[slug]` route addresses it. */
export const pageTag = (slug: string): string => fieldTag('pages', 'slug', slug)

/** One page, by id. */
export const pageIdTag = (id: number | string): string => idTag('pages', id)
