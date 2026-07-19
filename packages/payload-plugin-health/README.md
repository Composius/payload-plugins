# @composius/payload-plugin-health

A [Payload CMS](https://payloadcms.com) plugin that adds a health check
endpoint (default: `GET /api/health`) for load balancers, uptime monitors, and
container orchestrators.

Without options it reports `200 { status: 'ok' }` as soon as the Payload app is
serving requests. Optional named checks (e.g. a database probe) run on every
request; if any of them throws, the endpoint responds `503` with per-check
results.

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
  plugins: [
    ComposiusPayloadPluginHealth({
      checks: {
        database: async (req) => {
          // Probes the database through the admin user collection,
          // which always exists, whatever its slug.
          await req.payload.count({ collection: req.payload.config.admin.user })
        },
      },
    }),
  ],
  // ...
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

The `checks` key is omitted when no checks are configured.

## Options

| Option     | Type                          | Notes                                                                                                                                    |
| ---------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `path`     | `string`                      | endpoint path on the Payload API route, default `'/health'` (→ `/api/health` with the default Payload config)                             |
| `checks`   | `Record<string, HealthCheck>` | named checks run on every request; each receives the `PayloadRequest`, a throw marks the response `error` (503) with the message reported |
| `disabled` | `boolean`                     | leaves the config untouched                                                                                                               |

## Notes

- The endpoint is **unauthenticated** — anyone who can reach the API can call
  it. Keep check errors free of secrets: the thrown message is included in the
  response.
- Responses are sent with `Cache-Control: no-store`.
- Checks run in parallel; the response is `ok` only when every check resolves.
