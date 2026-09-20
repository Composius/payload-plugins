import type { Payload, RequiredDataFromCollectionSlug } from 'payload'

import { devUser } from '../../helpers/credentials.js'

export const seed = async (payload: Payload) => {
  const { totalDocs } = await payload.count({
    collection: 'users',
    where: {
      email: {
        equals: devUser.email,
      },
    },
  })

  if (!totalDocs) {
    // No role on purpose: the plugin forces the admin role on the first user.
    await payload.create({
      collection: 'users',
      data: {
        ...devUser,
        name: 'Dev User',
      } as RequiredDataFromCollectionSlug<'users'>,
    })
  }

  const { totalDocs: totalEditors } = await payload.count({
    collection: 'users',
    where: {
      email: {
        equals: 'editor@payloadcms.com',
      },
    },
  })

  if (!totalEditors) {
    await payload.create({
      collection: 'users',
      data: {
        name: 'Editor User',
        email: 'editor@payloadcms.com',
        password: 'test',
        role: 'editor',
      },
    })
  }
}
