import type { Config } from 'payload'

import { describe, expect, test } from 'vitest'

import { resolveLocalizedText, VWPayloadPluginHomeNav } from '../src/index.js'

const baseConfig = (): Config => ({ collections: [] }) as unknown as Config

type PluginComponent = {
  exportName?: string
  path?: string
  serverProps?: {
    href?: string
    icon?: unknown
    label?: unknown
  }
}

const icon = (config: Config) =>
  config.admin?.components?.graphics?.Icon as PluginComponent | undefined

const navLinks = (config: Config): PluginComponent[] =>
  (config.admin?.components?.beforeNavLinks ?? []) as PluginComponent[]

const homeLink = (config: Config) =>
  navLinks(config).find(
    (c) => c.path === '@vitrailweb/payload-plugin-home-nav/rsc' && c.exportName === 'HomeNavLink',
  )

describe('VWPayloadPluginHomeNav', () => {
  test('takes over the graphics.Icon slot with the labelled icon', () => {
    const config = VWPayloadPluginHomeNav()(baseConfig())

    expect(icon(config)?.path).toBe('@vitrailweb/payload-plugin-home-nav/rsc')
    expect(icon(config)?.exportName).toBe('HomeNavIcon')
    expect(icon(config)?.serverProps?.icon).toBeUndefined()
  })

  test('hands an existing custom icon to the component as serverProps', () => {
    const existing = {
      admin: {
        components: { graphics: { Icon: '/components/MyIcon#MyIcon' } },
      },
      collections: [],
    } as unknown as Config

    const config = VWPayloadPluginHomeNav()(existing)

    expect(icon(config)?.exportName).toBe('HomeNavIcon')
    expect(icon(config)?.serverProps?.icon).toBe('/components/MyIcon#MyIcon')
  })

  test('keeps an existing custom icon in the import map via admin.dependencies', () => {
    const existing = {
      admin: {
        components: { graphics: { Icon: '@/components/graphics/Icon#Icon' } },
      },
      collections: [],
    } as unknown as Config

    const config = VWPayloadPluginHomeNav()(existing)

    expect(config.admin?.dependencies?.['home-nav-icon']).toEqual({
      type: 'component',
      path: '@/components/graphics/Icon#Icon',
    })
  })

  test('normalizes the dependency key like the runtime lookup', () => {
    const noExport = VWPayloadPluginHomeNav()({
      admin: { components: { graphics: { Icon: '/components/MyIcon' } } },
      collections: [],
    } as unknown as Config)
    expect(noExport.admin?.dependencies?.['home-nav-icon']).toMatchObject({
      path: '/components/MyIcon#default',
    })

    const objectForm = VWPayloadPluginHomeNav()({
      admin: {
        components: {
          graphics: { Icon: { path: '/components/MyIcon', exportName: 'MyIcon' } },
        },
      },
      collections: [],
    } as unknown as Config)
    expect(objectForm.admin?.dependencies?.['home-nav-icon']).toMatchObject({
      path: '/components/MyIcon#MyIcon',
    })
  })

  test('adds no dependency when no custom icon exists', () => {
    const config = VWPayloadPluginHomeNav()(baseConfig())

    expect(config.admin?.dependencies).toBeUndefined()
  })

  test('prepends the home link to beforeNavLinks', () => {
    const existing = {
      admin: {
        components: { beforeNavLinks: [{ path: '/existing#Existing' }] },
      },
      collections: [],
    } as unknown as Config

    const config = VWPayloadPluginHomeNav()(existing)

    expect(navLinks(config)).toHaveLength(2)
    expect(navLinks(config)[0]).toBe(homeLink(config))
  })

  test('passes href and label as serverProps', () => {
    const label = { en: 'Site', fr: 'Site' }
    const config = VWPayloadPluginHomeNav({ href: '/', label })(baseConfig())

    expect(homeLink(config)?.serverProps).toMatchObject({ href: '/', label })
    expect(icon(config)?.serverProps?.label).toBe(label)
  })

  test('iconLabel: false leaves the graphics.Icon slot alone', () => {
    const config = VWPayloadPluginHomeNav({ iconLabel: false })(baseConfig())

    expect(config.admin?.components?.graphics?.Icon).toBeUndefined()
    expect(homeLink(config)).toBeDefined()
  })

  test('navLink: false adds no nav link', () => {
    const config = VWPayloadPluginHomeNav({ navLink: false })(baseConfig())

    expect(homeLink(config)).toBeUndefined()
    expect(icon(config)?.exportName).toBe('HomeNavIcon')
  })

  test('disabled leaves the config untouched', () => {
    const config = VWPayloadPluginHomeNav({ disabled: true })(baseConfig())

    expect(config.admin).toBeUndefined()
  })
})

describe('resolveLocalizedText', () => {
  test('passes plain strings and undefined through', () => {
    expect(resolveLocalizedText('Home', 'fr')).toBe('Home')
    expect(resolveLocalizedText(undefined, 'en')).toBeUndefined()
  })

  test('picks the current language from a record', () => {
    expect(resolveLocalizedText({ en: 'Home', fr: 'Accueil' }, 'fr')).toBe('Accueil')
  })

  test('falls back to en, then to the first value', () => {
    expect(resolveLocalizedText({ en: 'Home', fr: 'Accueil' }, 'de')).toBe('Home')
    expect(resolveLocalizedText({ fr: 'Accueil' }, 'de')).toBe('Accueil')
  })
})
