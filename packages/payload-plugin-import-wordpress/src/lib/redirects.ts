import type { Payload } from 'payload'

import { countDocs, createDoc } from './payloadOps.js'

export type CreateRedirectArgs = {
  articleId: number | string
  articlesSlug: string
  from: string
}

/**
 * Creates a 301 redirect (via @payloadcms/plugin-redirects' `redirects`
 * collection) from an old WordPress path to an imported article, unless one
 * already exists or the collection isn't installed. Returns whether a redirect
 * was created.
 */
export const createRedirect = async (
  payload: Payload,
  args: CreateRedirectArgs,
): Promise<boolean> => {
  if (!payload.collections.redirects) {
    return false
  }

  const { totalDocs } = await countDocs(payload, {
    collection: 'redirects',
    where: { from: { equals: args.from } },
  })
  if (totalDocs > 0) {
    return false
  }

  await createDoc(payload, {
    collection: 'redirects',
    data: {
      from: args.from,
      to: {
        type: 'reference',
        reference: { relationTo: args.articlesSlug, value: args.articleId },
      },
    },
  })
  return true
}
