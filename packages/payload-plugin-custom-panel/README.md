# @vitrailweb/payload-plugin-custom-panel

A [Payload CMS](https://payloadcms.com) plugin that adds a panel above the
admin dashboard (`admin.components.beforeDashboard`) showing the **site
title** and configurable **rows**, each pairing a **welcome or instructions
message** with **link buttons** rendered as card-like tiles — all configured
through plugin options.

The panel is a **server component**: the plugin's `access.read` is evaluated
per request, and denied users get nothing. Every text option accepts either a
plain string or a per-language record (`{ en: '…', fr: '…' }`) resolved
against the admin language.

## Requirements

The following dependencies are required to be installed in your project before using this plugin:

- `payload` (`^3.84.1`)
- `react` (`^19.0.0`)

```bash
pnpm add payload react
```

## Usage

```ts
import { buildConfig } from 'payload'
import { VWPayloadPluginCustomPanel } from '@vitrailweb/payload-plugin-custom-panel'

export default buildConfig({
  plugins: [
    VWPayloadPluginCustomPanel({
      title: 'My Site',
      rows: [
        {
          message: {
            en: 'Welcome! Manage pages and media from the sidebar.',
            fr: 'Bienvenue ! Gérez les pages et les médias depuis la barre latérale.',
          },
          links: [
            { label: 'View site', url: 'https://example.com', newTab: true, icon: '🌐' },
            { label: 'Media', url: '/admin/collections/media', icon: '/icons/media.svg' },
          ],
        },
        {
          message: 'Need help?',
          links: [
            { label: 'Documentation', url: 'https://payloadcms.com/docs', newTab: true, icon: '📚' },
          ],
        },
      ],
    }),
  ],
  // ...
})
```

To restrict who sees the panel, pass an `access` object (Payload `Access`
functions, like other plugins — only `read` for now):

```ts
VWPayloadPluginCustomPanel({
  // ...
  access: {
    read: ({ req: { user } }) => user?.role === 'admin',
  },
})
```

> Registers an admin component, so run `payload generate:importmap` after adding
> the plugin.

## Options

| Option     | Type                | Notes                                                                                             |
| ---------- | ------------------- | ------------------------------------------------------------------------------------------------- |
| `access`   | `{ read?: Access }` | who can see the panel — evaluated server-side when rendering (denied users get nothing). Default: any authenticated user |
| `title`    | `LocalizedText`     | site title, shown as the panel heading                                                            |
| `rows`     | `CustomPanelRow[]`  | rows shown under the title, in order — `{ message?: LocalizedText, links?: CustomPanelLink[] }`. The message (`\n` renders as line breaks) sits above the row's link tiles |

Each link in a row's `links` is a `CustomPanelLink`:
`{ label: LocalizedText, url: string, newTab?: boolean, icon?: string }` —
`icon` is an emoji/short text, or an image URL/path (`https://…`, `/…`,
`data:`) rendered as `<img>`. `newTab` links show an ↗ arrow in the tile's
corner (with a screen-reader hint).
| `disabled` | `boolean`           | leaves the config untouched                                                                        |

`LocalizedText` is `string | Record<string, string>` — a per-language record
is resolved as: exact admin-language match, then `en`, then the first value.

Options are all optional; rows with neither a message nor links are skipped,
and if `title` and `rows` are both empty, the panel renders nothing.

## Development

From the monorepo root:

```bash
pnpm install
pnpm generate:importmap:custom-panel                          # register the panel component
pnpm dev:custom-panel                                          # dev Payload app with this plugin
pnpm vitest run packages/payload-plugin-custom-panel/test      # unit tests
pnpm vitest run dev/configs/custom-panel                        # integration tests
pnpm --filter @vitrailweb/payload-plugin-custom-panel build    # build to dist/
```

See the [root README](../../README.md) for the release flow.
