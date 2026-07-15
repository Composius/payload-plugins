import type { Config } from 'payload'

import { afterEach, describe, expect, test, vi } from 'vitest'

import { VWPayloadPluginUmami } from '../src/index.js'

const baseConfig = (): Config => ({ collections: [] }) as unknown as Config

const cloudCreds = { websiteId: 'site-1', apiKey: 'key-1' }

const widgets = (config: Config) => config.admin?.dashboard?.widgets ?? []
const umamiWidget = (config: Config) => widgets(config).find((w) => w.slug === 'umami')
const hasReportEndpoint = (config: Config) =>
  (config.endpoints ?? []).some((e) => e.path === '/plugin-umami/report')

afterEach(() => {
  vi.restoreAllMocks()
})

describe('VWPayloadPluginUmami', () => {
  test('registers the report endpoint and the dashboard widget', () => {
    const config = VWPayloadPluginUmami(cloudCreds)(baseConfig())

    expect(hasReportEndpoint(config)).toBe(true)
    expect(umamiWidget(config)).toBeDefined()
    expect(JSON.stringify(umamiWidget(config))).toContain(
      '@vitrailweb/payload-plugin-umami/client',
    )
  })

  test('shows the widget in the default layout, before collections', () => {
    const config = VWPayloadPluginUmami(cloudCreds)(baseConfig())

    expect(config.admin?.dashboard?.defaultLayout).toEqual([
      { widgetSlug: 'umami', width: 'full' },
      { widgetSlug: 'collections', width: 'full' },
    ])
  })

  test('leaves a user-defined default layout untouched', () => {
    const existing = {
      admin: {
        dashboard: {
          defaultLayout: [{ widgetSlug: 'collections', width: 'full' }],
          widgets: [],
        },
      },
      collections: [],
    } as unknown as Config

    const config = VWPayloadPluginUmami(cloudCreds)(existing)

    expect(config.admin?.dashboard?.defaultLayout).toEqual([
      { widgetSlug: 'collections', width: 'full' },
    ])
    // The widget is still registered, available from the "add widget" drawer.
    expect(umamiWidget(config)).toBeDefined()
  })

  test('passes defaultRange and showRangeSelector as clientProps, not credentials', () => {
    const config = VWPayloadPluginUmami({
      ...cloudCreds,
      defaultRange: '30d',
      showRangeSelector: false,
    })(baseConfig())

    const serialized = JSON.stringify(umamiWidget(config))
    expect(serialized).toContain('"defaultRange":"30d"')
    expect(serialized).toContain('"showRangeSelector":false')
    // Credentials must never be serialized into the client component props.
    expect(serialized).not.toContain('key-1')
  })

  test('defaults stat cards to visitors/views and their previous period', () => {
    const config = VWPayloadPluginUmami(cloudCreds)(baseConfig())

    expect(JSON.stringify(umamiWidget(config))).toContain(
      '"stats":["visitors","views","visitorsPrev","viewsPrev"]',
    )
  })

  test('passes custom stat cards as clientProps', () => {
    const config = VWPayloadPluginUmami({
      ...cloudCreds,
      stats: ['visits', 'duration', 'durationPrev'],
    })(baseConfig())

    expect(JSON.stringify(umamiWidget(config))).toContain(
      '"stats":["visits","duration","durationPrev"]',
    )
  })

  test('preserves existing endpoints and dashboard widgets', () => {
    const existing = {
      admin: {
        dashboard: { widgets: [{ slug: 'other', Component: '/existing#Existing' }] },
      },
      collections: [],
      endpoints: [{ path: '/other', method: 'get', handler: async () => new Response() }],
    } as unknown as Config

    const config = VWPayloadPluginUmami(cloudCreds)(existing)

    expect(widgets(config)).toHaveLength(2)
    expect(config.endpoints).toHaveLength(2)
  })

  test('disabled leaves the config untouched', () => {
    const config = VWPayloadPluginUmami({ ...cloudCreds, disabled: true })(baseConfig())

    expect(hasReportEndpoint(config)).toBe(false)
    expect(umamiWidget(config)).toBeUndefined()
  })

  test('warns and registers nothing when websiteId is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const config = VWPayloadPluginUmami({ websiteId: '', apiKey: 'key-1' })(baseConfig())

    expect(warn).toHaveBeenCalledOnce()
    expect(hasReportEndpoint(config)).toBe(false)
    expect(umamiWidget(config)).toBeUndefined()
  })

  test('warns and registers nothing when credentials are missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const config = VWPayloadPluginUmami({ websiteId: 'site-1' })(baseConfig())

    expect(warn).toHaveBeenCalledOnce()
    expect(hasReportEndpoint(config)).toBe(false)
  })

  test('accepts self-hosted username/password as credentials', () => {
    const config = VWPayloadPluginUmami({
      websiteId: 'site-1',
      baseUrl: 'https://umami.example.com',
      username: 'admin',
      password: 'secret',
    })(baseConfig())

    expect(hasReportEndpoint(config)).toBe(true)
    // The self-hosted password must not leak into client props.
    expect(JSON.stringify(umamiWidget(config))).not.toContain('secret')
  })
})
