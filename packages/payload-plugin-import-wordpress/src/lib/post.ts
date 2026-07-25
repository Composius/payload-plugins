import type { WPPost } from './wpTypes.js'

/** The primary category of a post — WordPress core has no "primary", so the first assigned. */
export const selectPrimaryCategoryId = (post: WPPost): null | number =>
  Array.isArray(post.categories) && post.categories.length > 0 ? post.categories[0] : null

/** Best publish date for a post as an ISO string (prefers GMT). */
export const publishDate = (post: WPPost): string | undefined => {
  if (post.date_gmt) {
    // WordPress GMT dates omit the trailing Z.
    const value = post.date_gmt.endsWith('Z') ? post.date_gmt : `${post.date_gmt}Z`
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
  }
  if (post.date) {
    const date = new Date(post.date)
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
  }
  return undefined
}
