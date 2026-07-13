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

  const { totalDocs: totalMenus } = await payload.count({
    collection: 'menus',
  })

  if (!totalMenus) {
    await payload.create({
      collection: 'menus',
      data: {
        name: 'Main menu',
      },
    })
  }
}
