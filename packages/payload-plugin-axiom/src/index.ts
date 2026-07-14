import type { Config } from 'payload'
import type { DestinationStream, LevelWithSilent, LoggerOptions, StreamEntry } from 'pino'

import axiomTransport from '@axiomhq/pino'
import { multistream } from 'pino'

export type VWPayloadPluginAxiomConfig = {
  /**
   * The Axiom dataset the logs are ingested into.
   */
  dataset: string
  /**
   * An Axiom API token with ingest permission for the dataset.
   */
  token: string
  /**
   * Axiom organization ID. Only required when using a personal token.
   */
  orgId?: string
  /**
   * The Axiom edge domain logs are ingested through, without scheme
   * (`https://` is added automatically). Use this for regional targeting,
   * e.g. `'eu-central-1.aws.edge.axiom.co'`.
   */
  edge?: string
  /**
   * The Axiom edge URL for ingestion, with scheme (e.g.
   * `'https://eu-central-1.aws.edge.axiom.co'`). Takes precedence over
   * `edge` when both are set.
   */
  edgeUrl?: string
  /**
   * Base URL of the Axiom API, used for non-ingest operations. Do not use
   * it for regional targeting — that is what `edge` is for. Defaults to
   * `https://api.axiom.co`.
   */
  url?: string
  /**
   * Minimum level of the logger (applies to both Axiom and the console).
   * @default 'info'
   */
  level?: LevelWithSilent
  /**
   * Keep logging to stdout alongside Axiom. `true` (the default) writes
   * newline-delimited JSON to stdout. Pass a stream to customize it (e.g.
   * `pino-pretty`), or `false` to send logs to Axiom only.
   * @default true
   */
  console?: boolean | DestinationStream
  /**
   * Extra pino options merged into the logger (`name`, `redact`,
   * `formatters`, ...). `level` is managed by the plugin and cannot be
   * overridden here.
   */
  loggerOptions?: LoggerOptions
  disabled?: boolean
}

/**
 * The Axiom transport is created in-process and handed to Payload as a
 * destination stream, instead of a pino `transport` target: worker-thread
 * targets are resolved by module path at runtime, which breaks under
 * bundlers (Next.js/Turbopack) and pnpm's strict node_modules.
 */
export const VWPayloadPluginAxiom =
  (pluginOptions: VWPayloadPluginAxiomConfig) =>
  async (config: Config): Promise<Config> => {
    if (pluginOptions.disabled) {
      return config
    }

    const { dataset, edge, edgeUrl, orgId, token, url } = pluginOptions

    // Credentials usually come from env vars, which may be absent in some
    // environments (local dev, CI). Degrade to the default logger instead of
    // crashing the config build.
    if (!dataset || !token) {
      console.warn(
        '[@vitrailweb/payload-plugin-axiom] `dataset` or `token` is missing, logs will not be sent to Axiom.',
      )
      return config
    }

    const level = pluginOptions.level ?? 'info'

    const streams: StreamEntry<LevelWithSilent>[] = [
      {
        level,
        stream: await axiomTransport({
          dataset,
          token,
          ...(edge ? { edge } : {}),
          ...(edgeUrl ? { edgeUrl } : {}),
          ...(orgId ? { orgId } : {}),
          ...(url ? { url } : {}),
        }),
      },
    ]

    if (pluginOptions.console !== false) {
      streams.push({
        level,
        stream: typeof pluginOptions.console === 'object' ? pluginOptions.console : process.stdout,
      })
    }

    // Preserve pino options from a previously configured `logger: { options }`;
    // a logger instance or destination stream cannot be combined with
    // multistream and is replaced.
    const existingOptions =
      config.logger &&
      typeof config.logger === 'object' &&
      'options' in config.logger &&
      !('info' in config.logger)
        ? config.logger.options
        : undefined

    config.logger = {
      destination: multistream(streams),
      options: {
        ...existingOptions,
        ...pluginOptions.loggerOptions,
        level,
      },
    }

    // Emit a startup log through the now-configured logger so the Axiom
    // dataset shows the plugin is wired up correctly. onInit runs after boot,
    // when payload.logger uses the Axiom stream.
    const incomingOnInit = config.onInit
    config.onInit = async (payload) => {
      if (incomingOnInit) {
        await incomingOnInit(payload)
      }
      payload.logger.info(
        { dataset, plugin: '@vitrailweb/payload-plugin-axiom' },
        `Axiom logging enabled for dataset "${dataset}"`,
      )
    }

    return config
  }
