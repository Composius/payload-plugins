import type { SanitizedConfig } from 'payload'

import { beforeAll, describe, expect, test } from 'vitest'

type StreamEntry = { level?: string; stream: unknown }

let config: SanitizedConfig

// The config is imported dynamically so the Axiom credentials can be stubbed
// first (the plugin reads them when the config module is evaluated). The
// assertions run against the built config only — instantiating Payload would
// start logging and ship the entries to Axiom.
beforeAll(async () => {
  process.env.AXIOM_DATASET = 'test-dataset'
  process.env.AXIOM_TOKEN = 'test-token'

  config = await (await import('./config.js')).default
})

const getLogger = () => {
  const logger = config.logger as unknown as {
    destination: { streams: StreamEntry[] }
    options: { level?: string }
  }
  expect(logger).toBeDefined()
  return logger
}

describe('Plugin integration tests', () => {
  test('plugin configures the payload logger with an axiom stream and stdout', () => {
    const { destination, options } = getLogger()

    expect(options.level).toBe('info')
    expect(destination.streams).toHaveLength(2)
    expect(destination.streams.some((entry) => entry.stream === process.stdout)).toBe(true)
  })
})
