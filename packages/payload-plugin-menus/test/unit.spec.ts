import type { Access, Block, BlocksField, CollectionConfig, Config } from 'payload'

import { describe, expect, test } from 'vitest'

import { anyone, authenticated } from '../src/defaults.js'
import type { ComposiusPayloadPluginMenusConfig } from '../src/index.js'

import { ComposiusPayloadPluginMenus, menuIdTag, menuTag, MENUS_TAG } from '../src/index.js'

const accessArgs = (user: unknown) => ({ req: { user } }) as Parameters<Access>[0]

const baseConfig = (): Config => ({ collections: [] }) as unknown as Config

const findMenus = (config: Config): CollectionConfig => {
  const menus = config.collections?.find((collection) => collection.slug === 'menus')
  expect(menus).toBeDefined()
  return menus!
}

const findLinks = (menus: CollectionConfig): BlocksField => {
  const links = menus.fields.find((field) => (field as { name?: string }).name === 'links')
  expect(links).toBeDefined()
  return links as BlocksField
}

const blockSlugs = (links: BlocksField): string[] =>
  (links.blocks as Block[]).map((block) => block.slug)

describe('access defaults', () => {
  test('anyone always allows', () => {
    expect(anyone(accessArgs(null))).toBe(true)
    expect(anyone(accessArgs({ id: 1 }))).toBe(true)
  })

  test('authenticated allows only requests with a user', () => {
    expect(authenticated(accessArgs({ id: 1 }))).toBe(true)
    expect(authenticated(accessArgs(null))).toBe(false)
  })
})

describe('ComposiusPayloadPluginMenus', () => {
  test('adds the menus collection', () => {
    const config = ComposiusPayloadPluginMenus()(baseConfig())
    const menus = findMenus(config)

    const fieldNames = menus.fields.map((field) => (field as { name?: string }).name)
    expect(fieldNames).toContain('name')
    expect(fieldNames).toContain('links')
    expect(fieldNames).toContain('linksCount')
    expect(menus.admin?.useAsTitle).toBe('name')
    expect(menus.admin?.defaultColumns).toContain('linksCount')
  })

  test('links offers only external links by default', () => {
    const config = ComposiusPayloadPluginMenus()(baseConfig())
    const links = findLinks(findMenus(config))

    expect(blockSlugs(links)).toEqual(['external'])
  })

  test('links offers internal links when collections are configured', () => {
    const config = ComposiusPayloadPluginMenus({ collections: ['users', 'media'] })(baseConfig())
    const links = findLinks(findMenus(config))

    expect(blockSlugs(links)).toEqual(['internal', 'external'])

    const internal = (links.blocks as Block[]).find((block) => block.slug === 'internal')!
    const doc = internal.fields.find((field) => (field as { name?: string }).name === 'doc')
    expect(doc).toMatchObject({
      relationTo: ['users', 'media'],
      required: true,
      type: 'relationship',
    })
  })

  test('an internal link takes an optional anchor', () => {
    const config = ComposiusPayloadPluginMenus({ collections: ['users'] })(baseConfig())
    const links = findLinks(findMenus(config))

    const internal = (links.blocks as Block[]).find((block) => block.slug === 'internal')!
    const anchor = internal.fields.find((field) => (field as { name?: string }).name === 'anchor')
    expect(anchor).toMatchObject({ type: 'text' })
    expect((anchor as { required?: boolean }).required).toBeUndefined()
  })

  test('external links have no anchor', () => {
    const config = ComposiusPayloadPluginMenus({ collections: ['users'] })(baseConfig())
    const links = findLinks(findMenus(config))

    const external = (links.blocks as Block[]).find((block) => block.slug === 'external')!
    const fieldNames = external.fields.map((field) => (field as { name?: string }).name)
    expect(fieldNames).not.toContain('anchor')
  })

  test('default access: read is public, writes require a user', () => {
    const config = ComposiusPayloadPluginMenus()(baseConfig())
    const menus = findMenus(config)

    expect(menus.access?.read).toBe(anyone)
    expect(menus.access?.create).toBe(authenticated)
    expect(menus.access?.update).toBe(authenticated)
    expect(menus.access?.delete).toBe(authenticated)
  })

  test('custom access overrides replace only the provided operations', () => {
    const create: Access = () => false
    const config = ComposiusPayloadPluginMenus({ access: { create } })(baseConfig())
    const menus = findMenus(config)

    expect(menus.access?.create).toBe(create)
    expect(menus.access?.read).toBe(anyone)
  })

  test('collection is visible in the admin UI by default', () => {
    const config = ComposiusPayloadPluginMenus()(baseConfig())

    expect(findMenus(config).admin?.hidden).toBe(false)
  })

  test('hidden accepts a boolean', () => {
    const config = ComposiusPayloadPluginMenus({ hidden: true })(baseConfig())

    expect(findMenus(config).admin?.hidden).toBe(true)
  })

  test('hidden accepts a per-user function', () => {
    const hidden = ({ user }: { user: unknown }) =>
      (user as { role?: string } | null)?.role !== 'admin'
    const config = ComposiusPayloadPluginMenus({
      hidden: hidden as ComposiusPayloadPluginMenusConfig['hidden'],
    })(baseConfig())

    const configured = findMenus(config).admin?.hidden as (args: { user: unknown }) => boolean
    expect(configured({ user: { role: 'admin' } })).toBe(false)
    expect(configured({ user: { role: 'viewer' } })).toBe(true)
  })

  test('disabled still registers the collection for schema consistency', () => {
    const config = ComposiusPayloadPluginMenus({ disabled: true })(baseConfig())
    findMenus(config)
  })
})

describe('cache tags', () => {
  test('name the collection and the field addressing a document', () => {
    expect(MENUS_TAG).toBe('menus')
    expect(menuTag('Main')).toBe('menus:name:Main')
    expect(menuIdTag(2)).toBe('menus:id:2')
  })
})

describe('revalidation', () => {
  test('menus revalidate on change and on delete by default', () => {
    const menus = findMenus(ComposiusPayloadPluginMenus()(baseConfig()))

    expect(menus.hooks?.afterChange).toHaveLength(1)
    expect(menus.hooks?.afterDelete).toHaveLength(1)
  })

  test('the collection keeps its own hooks alongside the revalidation ones', () => {
    const menus = findMenus(ComposiusPayloadPluginMenus()(baseConfig()))

    expect(menus.hooks?.afterRead).toHaveLength(1)
    expect(menus.hooks?.beforeChange).toHaveLength(1)
  })

  test('revalidate: false leaves the collection without revalidation hooks', () => {
    const menus = findMenus(ComposiusPayloadPluginMenus({ revalidate: false })(baseConfig()))

    expect(menus.hooks?.afterChange).toBeUndefined()
    expect(menus.hooks?.afterDelete).toBeUndefined()
    expect(menus.hooks?.afterRead).toHaveLength(1)
  })

  test('a disabled plugin keeps its collection but stops revalidating', () => {
    const menus = findMenus(ComposiusPayloadPluginMenus({ disabled: true })(baseConfig()))

    expect(menus.hooks?.afterChange).toBeUndefined()
  })
})
