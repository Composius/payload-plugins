# @composius/payload-plugin-health

A [Payload CMS](https://payloadcms.com) plugin that adds a health check
endpoint (default: `GET /api/health`) for load balancers, uptime monitors, and
container orchestrators.

Without options it runs a built-in `database` check and reports
`200 { status: 'ok' }` as soon as the Payload app is serving requests. Further
named checks run on every request; if any of them throws, the endpoint responds
`503` with per-check results.

## Requirements

The following dependencies are required to be installed in your project before using this plugin:

- `payload` (`^3.84.1`)

```bash
pnpm add payload
```

## Usage

```ts
import { buildConfig } from 'payload'
import { ComposiusPayloadPluginHealth } from '@composius/payload-plugin-health'

export default buildConfig({
  plugins: [ComposiusPayloadPluginHealth()],
  // ...
})
```

The built-in `database` check probes the database through the admin user
collection, which always exists, whatever its slug. Turn it off with
`database: false`, or add your own checks alongside it:

```ts
ComposiusPayloadPluginHealth({
  checks: {
    cache: async () => {
      await redis.ping()
    },
  },
})
```

```bash
curl -i http://localhost:3000/api/health
```

Healthy response (`200`):

```json
{
  "status": "ok",
  "timestamp": "2026-07-18T12:00:00.000Z",
  "checks": { "database": { "status": "ok" } }
}
```

Failing response (`503`):

```json
{
  "status": "error",
  "timestamp": "2026-07-18T12:00:00.000Z",
  "checks": { "database": { "status": "error", "error": "connection refused" } }
}
```

The `checks` key is omitted when no checks are configured (i.e. with
`database: false` and no `checks`).

## Options

| Option     | Type                          | Notes                                                                                                                                    |
| ---------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `path`     | `string`                      | endpoint path on the Payload API route, default `'/health'` (→ `/api/health` with the default Payload config)                             |
| `database` | `boolean`                     | adds the built-in `database` check, default `true`; a `database` entry in `checks` takes precedence over it                               |
| `checks`   | `Record<string, HealthCheck>` | named checks run on every request; each receives the `PayloadRequest`, a throw marks the response `error` (503) with the message reported |
| `disabled` | `boolean`                     | leaves the config untouched                                                                                                               |

## Notes

- The endpoint is **unauthenticated** — anyone who can reach the API can call
  it. Keep check errors free of secrets: the thrown message is included in the
  response.
- Responses are sent with `Cache-Control: no-store`.
- Checks run in parallel; the response is `ok` only when every check resolves.
