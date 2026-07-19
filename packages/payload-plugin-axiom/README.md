# @composius/payload-plugin-axiom

A [Payload CMS](https://payloadcms.com) plugin that configures the Payload logger
to send logs to [Axiom](https://axiom.co), using the official
[`@axiomhq/pino`](https://axiom.co/docs/guides/pino) transport.

By default logs keep going to stdout as well, so local output and existing log
collection keep working.

## Requirements

The following dependencies are required to be installed in your project before using this plugin:

- `payload` (`^3.84.1`)

```bash
pnpm add payload
```

## Usage

```ts
import { buildConfig } from 'payload'
import { ComposiusPayloadPluginAxiom } from '@composius/payload-plugin-axiom'

export default buildConfig({
  plugins: [
    ComposiusPayloadPluginAxiom({
      dataset: process.env.AXIOM_DATASET || '',
      token: process.env.AXIOM_TOKEN || '',
    }),
  ],
  // ...
})
```

When `dataset` or `token` is empty (e.g. env vars not set in local dev or CI),
the plugin logs a warning and leaves the default Payload logger untouched
instead of failing.

## Options

| Option          | Type                                | Notes                                                                                                                                       |
| --------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `dataset`       | `string`                            | required — the Axiom dataset logs are ingested into                                                                                          |
| `token`         | `string`                            | required — an Axiom API token with ingest permission for the dataset                                                                         |
| `orgId`         | `string`                            | Axiom organization ID, only required for personal tokens                                                                                     |
| `edge`          | `string`                            | Axiom edge domain for ingestion, without scheme — use this for regional targeting (e.g. `eu-central-1.aws.edge.axiom.co`)                    |
| `edgeUrl`       | `string`                            | Axiom edge URL for ingestion, with scheme; takes precedence over `edge`                                                                      |
| `url`           | `string`                            | Axiom API base URL for non-ingest operations (default: `https://api.axiom.co`) — not for regional targeting, use `edge` instead              |
| `level`         | `pino.LevelWithSilent`              | minimum log level, default `'info'`                                                                                                          |
| `console`       | `boolean \| DestinationStream`      | `true` (default) also writes JSON logs to stdout; pass a stream to customize (e.g. `pino-pretty`), or `false` for Axiom only                |
| `loggerOptions` | `pino.LoggerOptions`                | extra pino options merged into the logger (`name`, `redact`, `formatters`, ...)                                                              |
| `disabled`      | `boolean`                           | leaves the config untouched                                                                                                                  |

### Pretty console output in development

```ts
import pretty from 'pino-pretty'

ComposiusPayloadPluginAxiom({
  dataset: process.env.AXIOM_DATASET || '',
  token: process.env.AXIOM_TOKEN || '',
  console: process.env.NODE_ENV === 'development' ? pretty({ colorize: true }) : true,
})
```

(`pino-pretty` must be installed in your project.)

## Notes

- The plugin sets `config.logger`. If the config already has
  `logger: { options }`, those pino options are preserved and merged; a logger
  instance or a destination stream is replaced.
- The Axiom transport runs in-process as a destination stream (via
  `pino.multistream`) instead of a worker-thread `transport` target, because
  targets are resolved by module path at runtime, which breaks under bundlers
  (Next.js/Turbopack) and pnpm's strict `node_modules`.
- Logs are batched by the Axiom client and flushed shortly after ingestion; an
  abrupt process kill can lose the last batch.
