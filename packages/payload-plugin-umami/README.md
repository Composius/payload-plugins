# @vitrailweb/payload-plugin-umami

A [Payload CMS](https://payloadcms.com) plugin that adds [Umami](https://umami.is)
web-analytics to the admin dashboard: configurable **stat cards** (default:
visitors and views, current and previous period), **top 5 pages**, **top 5
countries**, and a **visitors + views time chart**, all over a configurable
time range.

The panel is registered as a **dashboard widget** (like the built-in
collections widget): from the dashboard's edit mode it can be dragged,
resized, removed and re-added. By default it appears above the collections
widget; if the host config defines its own `admin.dashboard.defaultLayout`,
that layout is left untouched and the widget is only offered in the
"add widget" drawer.

Analytics are fetched **server-side** through a proxy endpoint
(`/api/plugin-umami/report`), so your Umami API key or password never reaches the
browser. The endpoint is admin-only (requires an authenticated Payload user).

## Usage

```ts
import { buildConfig } from 'payload'
import { VWPayloadPluginUmami } from '@vitrailweb/payload-plugin-umami'

export default buildConfig({
  plugins: [
    // Umami Cloud
    VWPayloadPluginUmami({
      websiteId: process.env.UMAMI_WEBSITE_ID || '',
      apiKey: process.env.UMAMI_API_KEY || '',
    }),
  ],
  // ...
})
```

For a **self-hosted** Umami instance, pass `baseUrl` + `username`/`password`
instead of `apiKey`:

```ts
VWPayloadPluginUmami({
  websiteId: process.env.UMAMI_WEBSITE_ID || '',
  baseUrl: process.env.UMAMI_BASE_URL || '', // e.g. https://umami.example.com
  username: process.env.UMAMI_USERNAME || '',
  password: process.env.UMAMI_PASSWORD || '',
})
```

To restrict who sees the analytics, pass an `access` object (Payload `Access`
functions, like other plugins — only `read` for now):

```ts
VWPayloadPluginUmami({
  // ...
  access: {
    read: ({ req: { user } }) => user?.role === 'admin',
  },
})
```

Denied users don't get the dashboard widget (it renders nothing, server-side)
and the report endpoint answers 403.

When `websiteId` or credentials are missing (e.g. env vars unset in local dev or
CI), the plugin logs a warning and registers nothing instead of failing the
config build.

> Registers an admin component, so run `payload generate:importmap` after adding
> the plugin.

## Options

| Option              | Type                                  | Notes                                                                                                  |
| ------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `access`            | `{ read?: Access }`                   | who can see the analytics — checked when rendering the widget (denied users get nothing) and in the report endpoint (403). Default: any authenticated user |
| `websiteId`         | `string`                              | required — the Umami website ID (UUID) to report on                                                    |
| `apiKey`            | `string`                              | Umami Cloud API key (`x-umami-api-key`). Use this **or** `username`/`password`; takes precedence       |
| `username`          | `string`                              | self-hosted username (with `password`)                                                                 |
| `password`          | `string`                              | self-hosted password (with `username`)                                                                 |
| `baseUrl`           | `string`                              | API base URL, default `https://api.umami.is` (Cloud). Set your instance URL for self-hosted            |
| `timezone`          | `string`                              | IANA timezone for the time-chart buckets, default the server timezone                                  |
| `defaultRange`      | `'24h' \| '7d' \| '30d' \| '90d'`     | initial range shown in the panel, default `'7d'`                                                       |
| `showRangeSelector` | `boolean`                             | show the in-panel range selector, default `true`                                                       |
| `stats`             | `UmamiStatId[]`                       | stat cards to show, in order — `visitors`, `views`, `visits`, `bounces`, `duration` (avg. visit duration) and their `...Prev` variants (previous period). Default `['visitors', 'views', 'visitorsPrev', 'viewsPrev']` |
| `disabled`          | `boolean`                             | leaves the config untouched                                                                            |

The time range is both configurable via `defaultRange` and changeable live in the
panel (unless `showRangeSelector: false`); changing it refetches and updates all
widgets at once.

## Development

From the monorepo root:

```bash
pnpm install
pnpm generate:importmap:umami                         # register the dashboard component
pnpm dev:umami                                         # dev Payload app with this plugin
pnpm vitest run packages/payload-plugin-umami/test     # unit tests
pnpm vitest run dev/configs/umami                       # integration tests
pnpm --filter @vitrailweb/payload-plugin-umami build   # build to dist/
```

See the [root README](../../README.md) for the release flow.
