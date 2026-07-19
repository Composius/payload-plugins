import type { Access, Config } from 'payload'

import { describe, expect, test, vi } from 'vitest'

import { resolveLocalizedText, ComposiusPayloadPluginCustomPanel } from '../src/index.js'

const baseConfig = (): Config => ({ collections: [] }) as unknown as Config

type PanelComponent = {
  exportName?: string
  path?: string
  serverProps?: {
    access?: Access
    rows?: unknown[]
    title?: unknown
  }
}

const panelComponents = (config: Config): PanelComponent[] =>
  (config.admin?.components?.beforeDashboard ?? []) as PanelComponent[]

const panel = (config: Config) =>
  panelComponents(config).find((c) => c.path === '@composius/payload-plugin-custom-panel/rsc')

describe('ComposiusPayloadPluginCustomPanel', () => {
  test('registers the beforeDashboard component', () => {
    const config = ComposiusPayloadPluginCustomPanel({ title: 'My Site' })(baseConfig())

    expect(panel(config)).toBeDefined()
    expect(panel(config)?.exportName).toBe('CustomPanel')
  })

  test('passes title and rows as serverProps', () => {
    const rows = [
      {
        message: 'Welcome aboard',
        links: [{ icon: '📚', label: 'Docs', url: 'https://example.com', newTab: true }],
      },
      { message: 'Second row' },
    ]
    const config = ComposiusPayloadPluginCustomPanel({
      title: 'My Site',
      rows,
    })(baseConfig())

    const serverProps = panel(config)?.serverProps
    expect(serverProps?.title).toBe('My Site')
    expect(serverProps?.rows).toEqual(rows)
  })

  test('defaults rows to an empty array', () => {
    const config = ComposiusPayloadPluginCustomPanel()(baseConfig())

    expect(panel(config)?.serverProps?.rows).toEqual([])
  })

  test('defaults read access to authenticated users, passed as serverProps', async () => {
    const config = ComposiusPayloadPluginCustomPanel({ title: 'My Site' })(baseConfig())

    const access = panel(config)?.serverProps?.access
    expect(access).toBeTypeOf('function')
    expect(await access?.({ req: { user: null } } as Parameters<Access>[0])).toBe(false)
    expect(await access?.({ req: { user: { id: 1 } } } as unknown as Parameters<Access>[0])).toBe(
      true,
    )
  })

  test('uses a custom access.read function', () => {
    const read = vi.fn(() => false)
    const config = ComposiusPayloadPluginCustomPanel({ access: { read } })(baseConfig())

    expect(panel(config)?.serverProps?.access).toBe(read)
  })

  test('preserves existing beforeDashboard components', () => {
    const existing = {
      admin: {
        components: { beforeDashboard: [{ path: '/existing#Existing' }] },
      },
      collections: [],
    } as unknown as Config

    const config = ComposiusPayloadPluginCustomPanel({ title: 'My Site' })(existing)

    expect(panelComponents(config)).toHaveLength(2)
    expect(panel(config)).toBeDefined()
  })

  test('disabled leaves the config untouched', () => {
    const config = ComposiusPayloadPluginCustomPanel({ title: 'My Site', disabled: true })(baseConfig())

    expect(panel(config)).toBeUndefined()
  })
})

describe('resolveLocalizedText', () => {
  test('passes plain strings and undefined through', () => {
    expect(resolveLocalizedText('Hello', 'fr')).toBe('Hello')
    expect(resolveLocalizedText(undefined, 'en')).toBeUndefined()
  })

  test('picks the current language from a record', () => {
    expect(resolveLocalizedText({ en: 'Hello', fr: 'Bonjour' }, 'fr')).toBe('Bonjour')
  })

  test('falls back to en, then to the first value', () => {
    expect(resolveLocalizedText({ en: 'Hello', fr: 'Bonjour' }, 'de')).toBe('Hello')
    expect(resolveLocalizedText({ fr: 'Bonjour' }, 'de')).toBe('Bonjour')
  })
})
