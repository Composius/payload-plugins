import type { SanitizedConfig } from 'payload'

import { beforeAll, describe, expect, test } from 'vitest'

import config from './config.js'

let sanitized: SanitizedConfig

beforeAll(async () => {
  sanitized = await config
})

describe('Plugin integration tests', () => {
  test('registers the beforeDashboard panel component', () => {
    const components = sanitized.admin?.components?.beforeDashboard ?? []
    const panel = components.find(
      (c) =>
        typeof c === 'object' && c.path === '@vitrailweb/payload-plugin-custom-panel/rsc',
    )
    expect(panel).toBeDefined()
    expect(typeof panel === 'object' && panel.exportName).toBe('CustomPanel')
  })

  test('carries the configured title and rows as serverProps', () => {
    const components = sanitized.admin?.components?.beforeDashboard ?? []
    const panel = components.find(
      (c) =>
        typeof c === 'object' && c.path === '@vitrailweb/payload-plugin-custom-panel/rsc',
    )
    const serverProps =
      typeof panel === 'object'
        ? (panel.serverProps as { rows?: unknown[]; title?: unknown })
        : undefined
    expect(serverProps?.title).toBe('Vitrail Web')
    expect(serverProps?.rows).toHaveLength(2)
  })
})
