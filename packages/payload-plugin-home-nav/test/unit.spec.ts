import type { Config } from 'payload'

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { resolveLocalizedText, ComposiusPayloadPluginHomeNav } from '../src/index.js'

const baseConfig = (): Config => ({ collections: [] }) as unknown as Config

type PluginComponent = {
  exportName?: string
  path?: string
  serverProps?: {
    href?: string
    icon?: unknown
    label?: unknown
    versionLabel?: unknown
    versionNumber?: string
  }
}

const icon = (config: Config) =>
  config.admin?.components?.graphics?.Icon as PluginComponent | undefined

const navLinks = (config: Config): PluginComponent[] =>
  (config.admin?.components?.beforeNavLinks ?? []) as PluginComponent[]

const homeLink = (config: Config) =>
  navLinks(config).find(
    (c) => c.path === '@composius/payload-plugin-home-nav/rsc' && c.exportName === 'HomeNavLink',
  )

const afterNavLinks = (config: Config): PluginComponent[] =>
  (config.admin?.components?.afterNavLinks ?? []) as PluginComponent[]

const versionBlock = (config: Config) =>
  afterNavLinks(config).find(
    (c) => c.path === '@composius/payload-plugin-home-nav/rsc' && c.exportName === 'HomeNavVersion',
  )

describe('ComposiusPayloadPluginHomeNav', () => {
  test('takes over the graphics.Icon slot with the labelled icon', () => {
    const config = ComposiusPayloadPluginHomeNav()(baseConfig())

    expect(icon(config)?.path).toBe('@composius/payload-plugin-home-nav/rsc')
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

    const config = ComposiusPayloadPluginHomeNav()(existing)

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

    const config = ComposiusPayloadPluginHomeNav()(existing)

    expect(config.admin?.dependencies?.['home-nav-icon']).toEqual({
      type: 'component',
      path: '@/components/graphics/Icon#Icon',
    })
  })

  test('normalizes the dependency key like the runtime lookup', () => {
    const noExport = ComposiusPayloadPluginHomeNav()({
      admin: { components: { graphics: { Icon: '/components/MyIcon' } } },
      collections: [],
    } as unknown as Config)
    expect(noExport.admin?.dependencies?.['home-nav-icon']).toMatchObject({
      path: '/components/MyIcon#default',
    })

    const objectForm = ComposiusPayloadPluginHomeNav()({
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
    const config = ComposiusPayloadPluginHomeNav()(baseConfig())

    expect(config.admin?.dependencies).toBeUndefined()
  })

  test('prepends the home link to beforeNavLinks', () => {
    const existing = {
      admin: {
        components: { beforeNavLinks: [{ path: '/existing#Existing' }] },
      },
      collections: [],
    } as unknown as Config

    const config = ComposiusPayloadPluginHomeNav()(existing)

    expect(navLinks(config)).toHaveLength(2)
    expect(navLinks(config)[0]).toBe(homeLink(config))
  })

  test('passes href and label as serverProps', () => {
    const label = { en: 'Site', fr: 'Site' }
    const config = ComposiusPayloadPluginHomeNav({ href: '/', label })(baseConfig())

    expect(homeLink(config)?.serverProps).toMatchObject({ href: '/', label })
    expect(icon(config)?.serverProps?.label).toBe(label)
  })

  test('iconLabel: false leaves the graphics.Icon slot alone', () => {
    const config = ComposiusPayloadPluginHomeNav({ iconLabel: false })(baseConfig())

    expect(config.admin?.components?.graphics?.Icon).toBeUndefined()
    expect(homeLink(config)).toBeDefined()
  })

  test('navLink: false adds no nav link', () => {
    const config = ComposiusPayloadPluginHomeNav({ navLink: false })(baseConfig())

    expect(homeLink(config)).toBeUndefined()
    expect(icon(config)?.exportName).toBe('HomeNavIcon')
  })

  test('appends the version block to afterNavLinks', () => {
    const existing = {
      admin: {
        components: { afterNavLinks: [{ path: '/existing#Existing' }] },
      },
      collections: [],
    } as unknown as Config

    const config = ComposiusPayloadPluginHomeNav()(existing)

    expect(afterNavLinks(config)).toHaveLength(2)
    // Last, so it stays directly above the logout button.
    expect(afterNavLinks(config)[1]).toBe(versionBlock(config))
  })

  test('passes the version overrides as serverProps', () => {
    const versionLabel = { en: 'Build', fr: 'Version' }
    const config = ComposiusPayloadPluginHomeNav({ versionLabel, versionNumber: '2.1.0' })(
      baseConfig(),
    )

    expect(versionBlock(config)?.serverProps).toMatchObject({
      versionLabel,
      versionNumber: '2.1.0',
    })
  })

  test('version: false adds no version block', () => {
    const config = ComposiusPayloadPluginHomeNav({ version: false })(baseConfig())

    expect(versionBlock(config)).toBeUndefined()
    expect(homeLink(config)).toBeDefined()
  })

  test('disabled leaves the config untouched', () => {
    const config = ComposiusPayloadPluginHomeNav({ disabled: true })(baseConfig())

    expect(config.admin).toBeUndefined()
  })
})

describe('resolveAppVersion', () => {
  const created: string[] = []

  /** An app root with the given package.json, plus a nested working dir. */
  const appTree = (packageJson: unknown) => {
    const root = mkdtempSync(path.join(tmpdir(), 'home-nav-'))
    created.push(root)
    writeFileSync(path.join(root, 'package.json'), JSON.stringify(packageJson))
    const nested = path.join(root, '.next', 'server')
    mkdirSync(nested, { recursive: true })
    return { nested, root }
  }

  /** The module memoizes, so each case needs a fresh copy of it. */
  const load = async (cwd: string) => {
    vi.resetModules()
    vi.spyOn(process, 'cwd').mockReturnValue(cwd)
    return await import('../src/version.js')
  }

  const logger = () => ({ info: vi.fn(), warn: vi.fn() })

  afterEach(() => {
    vi.restoreAllMocks()
    for (const dir of created.splice(0)) rmSync(dir, { force: true, recursive: true })
  })

  test('walks up from the working directory to the nearest version', async () => {
    const { nested } = appTree({ name: 'my-app', version: '3.2.1' })
    const { resolveAppVersion } = await load(nested)

    expect(resolveAppVersion()).toBe('3.2.1')
  })

  test('logs the version and the file it came from, once', async () => {
    const { nested, root } = appTree({ name: 'my-app', version: '3.2.1' })
    const { resolveAppVersion } = await load(nested)
    const log = logger()

    expect(resolveAppVersion(log)).toBe('3.2.1')
    expect(log.info).toHaveBeenCalledTimes(1)
    expect(log.info.mock.calls[0][0]).toContain('3.2.1')
    expect(log.info.mock.calls[0][0]).toContain(path.join(root, 'package.json'))
    expect(log.warn).not.toHaveBeenCalled()

    // Cached — the walk, and the log with it, does not run again.
    expect(resolveAppVersion(log)).toBe('3.2.1')
    expect(log.info).toHaveBeenCalledTimes(1)
  })

  test('skips a package.json without a usable version', async () => {
    const { root } = appTree({ name: 'my-app', version: '' })
    const child = path.join(root, 'apps', 'web')
    mkdirSync(child, { recursive: true })
    writeFileSync(path.join(child, 'package.json'), JSON.stringify({ name: 'web' }))

    const { resolveAppVersion } = await load(child)

    // Neither declares one — the walk continues past both without throwing.
    expect(resolveAppVersion()).not.toBe('')
  })

  test('warns once when no version can be resolved', async () => {
    const { root } = appTree({ name: 'my-app' })
    const { resolveAppVersion } = await load(root)
    const log = logger()

    // The monorepo checkout is above tmpdir on no platform, so the walk from a
    // temp app root ends without a version.
    expect(resolveAppVersion(log)).toBeUndefined()
    expect(log.warn).toHaveBeenCalledTimes(1)
    expect(log.warn.mock.calls[0][0]).toContain('payload-plugin-home-nav')
    expect(log.info).not.toHaveBeenCalled()

    // Cached — the walk, and the warning with it, does not run again.
    expect(resolveAppVersion(log)).toBeUndefined()
    expect(log.warn).toHaveBeenCalledTimes(1)
  })

  test('warns about a missing package.json distinctly from a missing version', async () => {
    const { root } = appTree({ name: 'my-app' })
    const withPackageJson = logger()
    const { resolveAppVersion: resolveWith } = await load(root)
    resolveWith(withPackageJson)

    const missing = path.join(root, 'no-package-json')
    mkdirSync(missing, { recursive: true })
    rmSync(path.join(root, 'package.json'))
    const withoutPackageJson = logger()
    const { resolveAppVersion: resolveWithout } = await load(missing)
    resolveWithout(withoutPackageJson)

    expect(withPackageJson.warn.mock.calls[0][0]).toContain('declares a "version"')
    expect(withoutPackageJson.warn.mock.calls[0][0]).toContain('No package.json found')
  })

  test('caches the lookup', async () => {
    const { nested, root } = appTree({ name: 'my-app', version: '1.0.0' })
    const { resolveAppVersion } = await load(nested)

    expect(resolveAppVersion()).toBe('1.0.0')
    writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '9.9.9' }))
    expect(resolveAppVersion()).toBe('1.0.0')
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
