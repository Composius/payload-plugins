import type { Payload } from 'payload'

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
    await payload.create({
      collection: 'users',
      data: devUser,
    })
  }

  const { totalDocs: totalRedirections } = await payload.count({
    collection: 'redirections',
  })

  if (!totalRedirections) {
    // One rule per match type, plus a disabled one so the rules endpoint has
    // something to leave out.
    await payload.create({
      collection: 'redirections',
      data: { from: '/old-page', matchType: 'exact', status: '301', to: '/new-page' },
    })

    await payload.create({
      collection: 'redirections',
      data: { from: '/blog', matchType: 'prefix', status: '307', to: '/articles' },
    })

    await payload.create({
      collection: 'redirections',
      data: { from: '^/p/(\\d+)$', matchType: 'regex', status: '307', to: '/posts/$1' },
    })

    await payload.create({
      collection: 'redirections',
      data: {
        enabled: false,
        from: '/parked',
        matchType: 'exact',
        status: '307',
        to: '/somewhere',
      },
    })
  }
}
