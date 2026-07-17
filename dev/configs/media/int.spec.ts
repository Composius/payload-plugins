import type { Payload } from 'payload'

import { getPayload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import config from './config.js'

let payload: Payload

afterAll(async () => {
  // Deleting the docs makes Payload remove their files from staticDir;
  // keep the doc seeded by seed.ts (alt: 'Sample image')
  await payload.delete({ collection: 'media', where: { alt: { equals: 'Test image' } } })
  await payload.destroy()
})

beforeAll(async () => {
  payload = await getPayload({ config })
})

const createImage = async (name: string, width = 1600, height = 900) => {
  const data = await sharp({
    create: { width, height, channels: 3, background: { b: 40, g: 80, r: 200 } },
  })
    .png()
    .toBuffer()

  return payload.create({
    collection: 'media',
    data: { alt: 'Test image' },
    file: { data, mimetype: 'image/png', name, size: data.length },
  })
}

describe('Plugin integration tests', () => {
  test('plugin adds the media collection', () => {
    expect(payload.collections['media']).toBeDefined()
  })

  test('uploads are converted to WebP', async () => {
    // This suite runs with randomSuffix: false, so the name stays stable
    const doc = await createImage('photo.png')

    expect(doc.filename).toBe('photo.webp')
    expect(doc.mimeType).toBe('image/webp')
    expect(doc.alt).toBe('Test image')
  })

  test('the default image sizes are generated', async () => {
    const doc = await createImage('sizes.png')

    expect(doc.sizes?.thumbnail?.width).toBe(300)
    expect(doc.sizes?.small?.width).toBe(600)
    expect(doc.sizes?.medium?.width).toBe(900)
    expect(doc.sizes?.large?.width).toBe(1400)
    expect(doc.sizes?.og).toMatchObject({ height: 630, width: 1200 })
  })

  test('the original is capped at 2560px wide', async () => {
    const doc = await createImage('wide.png', 4000, 1000)

    expect(doc.width).toBe(2560)
  })

  test('a small original is not enlarged', async () => {
    const doc = await createImage('small.png', 800, 450)

    expect(doc.width).toBe(800)
  })
})
