import type { SanitizedConfig } from 'payload'

import { beforeAll, describe, expect, test } from 'vitest'

let config: SanitizedConfig

// The config is imported dynamically so the Umami credentials can be stubbed
// first (the plugin reads them when the config module is evaluated). The
// plugin only registers the endpoint and dashboard component when a websiteId
// and credentials are present.
beforeAll(async () => {
  process.env.UMAMI_WEBSITE_ID = 'test-website-id'
  process.env.UMAMI_API_KEY = 'test-api-key'

  config = await (await import('./config.js')).default
})

describe('Plugin integration tests', () => {
  test('registers the report proxy endpoint', () => {
    const endpoint = config.endpoints?.find((e) => e.path === '/plugin-umami/report')
    expect(endpoint).toBeDefined()
    expect(endpoint?.method).toBe('get')
  })

  test('registers the umami dashboard widget', () => {
    const widget = config.admin?.dashboard?.widgets?.find((w) => w.slug === 'umami')
    expect(widget).toBeDefined()
    const serialized = JSON.stringify(widget)
    expect(serialized).toContain('@composius/payload-plugin-umami/rsc')
    expect(serialized).toContain('UmamiWidget')
  })

  test('shows the widget in the default layout alongside collections', () => {
    const layout = config.admin?.dashboard?.defaultLayout
    expect(layout).toEqual([
      { widgetSlug: 'umami', width: 'full' },
      { widgetSlug: 'collections', width: 'full' },
    ])
  })
})
