import type { SanitizedConfig } from 'payload'

import { beforeAll, describe, expect, test } from 'vitest'

import config from './config.js'

let sanitized: SanitizedConfig

beforeAll(async () => {
  sanitized = await config
})

describe('Plugin integration tests', () => {
  test('takes over the graphics.Icon slot with the labelled icon', () => {
    const Icon = sanitized.admin?.components?.graphics?.Icon
    expect(Icon).toBeDefined()
    expect(typeof Icon === 'object' && Icon.path).toBe('@composius/payload-plugin-home-nav/rsc')
    expect(typeof Icon === 'object' && Icon.exportName).toBe('HomeNavIcon')
  })

  test('registers the home link before the nav links', () => {
    const components = sanitized.admin?.components?.beforeNavLinks ?? []
    const link = components.find(
      (c) => typeof c === 'object' && c.path === '@composius/payload-plugin-home-nav/rsc',
    )
    expect(link).toBeDefined()
    expect(typeof link === 'object' && link.exportName).toBe('HomeNavLink')
  })
})
