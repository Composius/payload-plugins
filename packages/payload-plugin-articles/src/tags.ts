import { collectionTag, fieldTag, idTag } from '@composius/payload-plugin-shared-components/tags'

/**
 * The cache tags the collection hooks invalidate. Claim the matching one with
 * `cacheTag` inside a `'use cache'` function and a save in the admin panel
 * reaches the front end.
 *
 * Re-exported from `@composius/payload-plugin-articles/tags`, which pulls in
 * neither `payload` nor `next` and is the import to reach for in page code.
 */

/** Every article: listings, archives, sitemaps, "latest articles" blocks. */
export const ARTICLES_TAG = collectionTag('articles')

/** One article, addressed the way a `/articles/[slug]` route addresses it. */
export const articleTag = (slug: string): string => fieldTag('articles', 'slug', slug)

/** One article, by id. */
export const articleIdTag = (id: number | string): string => idTag('articles', id)

/**
 * Every category. Also invalidated whenever an article changes, since a
 * category listing counts and lists the articles inside it.
 */
export const CATEGORIES_TAG = collectionTag('categories')

/** One category, by slug. */
export const categoryTag = (slug: string): string => fieldTag('categories', 'slug', slug)

/** One category, by id. */
export const categoryIdTag = (id: number | string): string => idTag('categories', id)

/** Every author. Only present when the `authors` option is enabled. */
export const AUTHORS_TAG = collectionTag('authors')

/** One author, by id. Authors have no slug of their own. */
export const authorIdTag = (id: number | string): string => idTag('authors', id)
