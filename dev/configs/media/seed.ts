import type { Payload } from 'payload'

import sharp from 'sharp'

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

  const { totalDocs: totalMedia } = await payload.count({
    collection: 'media',
  })

  if (!totalMedia) {
    const data = await sharp({
      create: { background: { b: 84, g: 46, r: 30 }, channels: 3, height: 900, width: 1600 },
    })
      .png()
      .toBuffer()

    // Re-seeding after a db reset overwrites the same files instead of
    // accumulating new ones (this suite runs with randomSuffix: false)
    await payload.create({
      collection: 'media',
      data: { alt: 'Sample image' },
      file: { name: 'sample.png', data, mimetype: 'image/png', size: data.length },
      overwriteExistingFiles: true,
    })
  }
}
