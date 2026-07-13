import type { Access, CollectionConfig, Config } from 'payload'

import { describe, expect, test } from 'vitest'

import { anyone, authenticated } from '../src/defaults.js'
import { VWPayloadPluginMenus } from '../src/index.js'

const accessArgs = (user: unknown) => ({ req: { user } }) as Parameters<Access>[0]

const baseConfig = (): Config => ({ collections: [] }) as unknown as Config

const findMenus = (config: Config): CollectionConfig => {
  const menus = config.collections?.find((collection) => collection.slug === 'menus')
  expect(menus).toBeDefined()
  return menus!
}

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

describe('VWPayloadPluginMenus', () => {
  test('adds the menus collection', () => {
    const config = VWPayloadPluginMenus()(baseConfig())
    const menus = findMenus(config)

    const fieldNames = menus.fields.map((field) => (field as { name?: string }).name)
    expect(fieldNames).toContain('title')
    expect(menus.admin?.useAsTitle).toBe('title')
  })

  test('default access: read is public, writes require a user', () => {
    const config = VWPayloadPluginMenus()(baseConfig())
    const menus = findMenus(config)

    expect(menus.access?.read).toBe(anyone)
    expect(menus.access?.create).toBe(authenticated)
    expect(menus.access?.update).toBe(authenticated)
    expect(menus.access?.delete).toBe(authenticated)
  })

  test('custom access overrides replace only the provided operations', () => {
    const create: Access = () => false
    const config = VWPayloadPluginMenus({ access: { create } })(baseConfig())
    const menus = findMenus(config)

    expect(menus.access?.create).toBe(create)
    expect(menus.access?.read).toBe(anyone)
  })

  test('disabled still registers the collection for schema consistency', () => {
    const config = VWPayloadPluginMenus({ disabled: true })(baseConfig())
    findMenus(config)
  })
})
