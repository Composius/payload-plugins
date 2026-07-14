import type { Config } from 'payload'

import { PassThrough } from 'node:stream'
import { levels } from 'pino'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { VWPayloadPluginAxiom } from '../src/index.js'

// The real transport would instantiate an Axiom ingest client.
vi.mock('@axiomhq/pino', () => ({
  default: vi.fn(async () => new PassThrough()),
}))

const axiomTransport = vi.mocked((await import('@axiomhq/pino')).default)

const baseConfig = (): Config => ({ collections: [] }) as unknown as Config

const credentials = { dataset: 'my-dataset', token: 'my-token' }

// multistream re-sorts entries and converts levels to numbers, so
// assertions on streams must be order-independent and use numeric levels.
type ResolvedStream = { level?: number | string; stream: unknown }

const getLogger = (config: Config) => {
  const logger = config.logger
  expect(logger).toBeDefined()
  expect(typeof logger).toBe('object')
  return logger as unknown as {
    destination: { streams: ResolvedStream[] }
    options: Record<string, unknown>
  }
}

const getStreams = (config: Config): ResolvedStream[] => getLogger(config).destination.streams

afterEach(() => {
  vi.clearAllMocks()
})

describe('VWPayloadPluginAxiom', () => {
  test('creates the axiom transport with the credentials', async () => {
    await VWPayloadPluginAxiom({
      ...credentials,
      edge: 'eu-central-1.aws.edge.axiom.co',
      edgeUrl: 'https://eu-central-1.aws.edge.axiom.co',
      orgId: 'my-org',
      url: 'https://api.eu.axiom.co',
    })(baseConfig())

    expect(axiomTransport).toHaveBeenCalledExactlyOnceWith({
      dataset: 'my-dataset',
      edge: 'eu-central-1.aws.edge.axiom.co',
      edgeUrl: 'https://eu-central-1.aws.edge.axiom.co',
      orgId: 'my-org',
      token: 'my-token',
      url: 'https://api.eu.axiom.co',
    })
  })

  test('omits the optional endpoint options when not provided', async () => {
    await VWPayloadPluginAxiom(credentials)(baseConfig())

    expect(axiomTransport).toHaveBeenCalledExactlyOnceWith(credentials)
  })

  test('logs to the axiom stream and stdout by default', async () => {
    const config = await VWPayloadPluginAxiom(credentials)(baseConfig())
    const streams = getStreams(config)

    expect(streams).toHaveLength(2)
    expect(streams.map((entry) => entry.stream)).toContain(
      await axiomTransport.mock.results[0].value,
    )
    expect(streams.map((entry) => entry.stream)).toContain(process.stdout)
  })

  test('console: false sends logs to Axiom only', async () => {
    const config = await VWPayloadPluginAxiom({ ...credentials, console: false })(baseConfig())

    expect(getStreams(config)).toHaveLength(1)
  })

  test('console accepts a custom stream', async () => {
    const custom = new PassThrough()
    const config = await VWPayloadPluginAxiom({ ...credentials, console: custom })(baseConfig())

    expect(getStreams(config).map((entry) => entry.stream)).toContain(custom)
  })

  test('level defaults to info and applies to the logger and streams', async () => {
    const defaulted = await VWPayloadPluginAxiom(credentials)(baseConfig())
    expect(getLogger(defaulted).options.level).toBe('info')

    const config = await VWPayloadPluginAxiom({ ...credentials, level: 'warn' })(baseConfig())
    expect(getLogger(config).options.level).toBe('warn')
    expect(getStreams(config).every((entry) => entry.level === levels.values.warn)).toBe(true)
  })

  test('merges extra pino options without letting them override the level', async () => {
    const config = await VWPayloadPluginAxiom({
      ...credentials,
      level: 'debug',
      loggerOptions: { level: 'trace', name: 'my-app' },
    })(baseConfig())

    const options = getLogger(config).options
    expect(options.name).toBe('my-app')
    expect(options.level).toBe('debug')
  })

  test('preserves pino options from a pre-existing logger config', async () => {
    const config = baseConfig()
    config.logger = { options: { name: 'existing' } }

    const result = await VWPayloadPluginAxiom(credentials)(config)
    expect(getLogger(result).options.name).toBe('existing')
  })

  test('warns and leaves the logger untouched when credentials are missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const config = await VWPayloadPluginAxiom({ dataset: 'my-dataset', token: '' })(baseConfig())

    expect(config.logger).toBeUndefined()
    expect(axiomTransport).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  test('disabled leaves the config untouched', async () => {
    const config = await VWPayloadPluginAxiom({ ...credentials, disabled: true })(baseConfig())

    expect(config.logger).toBeUndefined()
    expect(axiomTransport).not.toHaveBeenCalled()
  })

  test('logs a startup info message via onInit and preserves the existing one', async () => {
    const existingOnInit = vi.fn()
    const config = baseConfig()
    config.onInit = existingOnInit

    const result = await VWPayloadPluginAxiom(credentials)(config)

    const info = vi.fn()
    await result.onInit!({ logger: { info } } as never)

    expect(existingOnInit).toHaveBeenCalledOnce()
    expect(info).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ dataset: 'my-dataset' }),
      expect.stringContaining('my-dataset'),
    )
  })
})
