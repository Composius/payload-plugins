import type { Payload } from 'payload'

import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import config from './config.js'

let payload: Payload

afterAll(async () => {
  await payload.destroy()
})

beforeAll(async () => {
  payload = await getPayload({ config })
})

const createUser = (email: string) =>
  payload.create({
    collection: 'users',
    data: { email, password: 'test' },
  })

describe('Plugin integration tests', () => {
  test('plugin adds the menus collection', () => {
    expect(payload.collections['menus']).toBeDefined()
  })

  test('can create a menu', async () => {
    const menu = await payload.create({
      collection: 'menus',
      data: {
        name: 'Footer menu',
      },
    })

    expect(menu.name).toBe('Footer menu')
  })

  test('linksCount reflects the number of links', async () => {
    const empty = await payload.create({
      collection: 'menus',
      data: { name: 'Empty menu' },
    })
    expect(empty.linksCount).toBe(0)

    const menu = await payload.create({
      collection: 'menus',
      data: {
        name: 'Counted menu',
        links: [
          { blockType: 'external', title: 'One', url: 'https://example.com/1' },
          { blockType: 'external', title: 'Two', url: 'https://example.com/2' },
        ],
      },
    })
    expect(menu.linksCount).toBe(2)
  })

  test('stores external links', async () => {
    const menu = await payload.create({
      collection: 'menus',
      data: {
        name: 'External menu',
        links: [
          { blockType: 'external', newTab: true, title: 'Payload', url: 'https://payloadcms.com' },
        ],
      },
    })

    expect(menu.links?.[0]).toMatchObject({
      blockType: 'external',
      newTab: true,
      title: 'Payload',
      url: 'https://payloadcms.com',
    })
  })

  test('internal link title resolves from the linked document', async () => {
    const user = await createUser('internal@example.com')
    const menu = await payload.create({
      collection: 'menus',
      data: {
        name: 'Internal menu',
        links: [{ blockType: 'internal', doc: { relationTo: 'users', value: user.id } }],
      },
    })

    expect(menu.links?.[0]?.title).toBe('internal@example.com')

    const shallow = await payload.findByID({ collection: 'menus', id: menu.id, depth: 0 })
    expect(shallow.links?.[0]?.title).toBe('internal@example.com')
  })

  test('internal link title follows a rename of the linked document', async () => {
    const user = await createUser('before@example.com')
    const menu = await payload.create({
      collection: 'menus',
      data: {
        name: 'Live title menu',
        links: [{ blockType: 'internal', doc: { relationTo: 'users', value: user.id } }],
      },
    })

    await payload.update({
      collection: 'users',
      id: user.id,
      data: { email: 'after@example.com' },
    })

    const updated = await payload.findByID({ collection: 'menus', id: menu.id })
    expect(updated.links?.[0]?.title).toBe('after@example.com')
  })

  test('stores an anchor on an internal link, without its leading #', async () => {
    const user = await createUser('anchor@example.com')
    const menu = await payload.create({
      collection: 'menus',
      data: {
        name: 'Anchor menu',
        links: [
          {
            anchor: '#contact',
            blockType: 'internal',
            doc: { relationTo: 'users', value: user.id },
          },
          {
            anchor: 'pricing',
            blockType: 'internal',
            doc: { relationTo: 'users', value: user.id },
          },
          { blockType: 'internal', doc: { relationTo: 'users', value: user.id } },
        ],
      },
    })

    expect(menu.links?.[0]?.anchor).toBe('contact')
    expect(menu.links?.[1]?.anchor).toBe('pricing')
    expect(menu.links?.[2]?.anchor).toBeFalsy()
  })

  test('a custom title overrides the linked document title', async () => {
    const user = await createUser('override@example.com')
    const menu = await payload.create({
      collection: 'menus',
      data: {
        name: 'Override menu',
        links: [
          {
            blockType: 'internal',
            doc: { relationTo: 'users', value: user.id },
            title: 'Custom title',
          },
        ],
      },
    })

    expect(menu.links?.[0]?.title).toBe('Custom title')

    await payload.update({
      collection: 'users',
      id: user.id,
      data: { email: 'renamed-override@example.com' },
    })

    const updated = await payload.findByID({ collection: 'menus', id: menu.id })
    expect(updated.links?.[0]?.title).toBe('Custom title')
  })

  test('saving the auto-resolved title back does not freeze it', async () => {
    const user = await createUser('echo@example.com')
    const menu = await payload.create({
      collection: 'menus',
      data: {
        name: 'Echo menu',
        links: [{ blockType: 'internal', doc: { relationTo: 'users', value: user.id } }],
      },
    })

    // The admin form echoes the title resolved by afterRead back on save.
    await payload.update({
      collection: 'menus',
      id: menu.id,
      data: {
        links: [
          {
            blockType: 'internal',
            doc: { relationTo: 'users', value: user.id },
            title: 'echo@example.com',
          },
        ],
      },
    })

    await payload.update({
      collection: 'users',
      id: user.id,
      data: { email: 'echo-renamed@example.com' },
    })

    const updated = await payload.findByID({ collection: 'menus', id: menu.id })
    expect(updated.links?.[0]?.title).toBe('echo-renamed@example.com')
  })

  // The revalidation hooks run inside the write's transaction, and there is no
  // Next.js request scope here to revalidate against. Every write below must
  // still go through: a cache that cannot be reached is not a failed write.
  test('saving and deleting survive without a Next.js runtime', async () => {
    const menu = await payload.create({
      collection: 'menus',
      data: { name: 'Cached menu' },
    })

    const renamed = await payload.update({
      collection: 'menus',
      id: menu.id,
      data: { name: 'Cached menu renamed' },
    })
    expect(renamed.name).toBe('Cached menu renamed')

    await payload.delete({ collection: 'menus', id: menu.id })

    const remaining = await payload.find({
      collection: 'menus',
      where: { name: { equals: 'Cached menu renamed' } },
    })
    expect(remaining.totalDocs).toBe(0)
  })
})
