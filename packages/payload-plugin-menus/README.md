# @vitrailweb/payload-plugin-menus

A [Payload CMS](https://payloadcms.com) plugin that adds a `menus` collection.

## Fields

| Field   | Type   | Notes                         |
| ------- | ------ | ----------------------------- |
| `title` | `text` | required, used as admin title |

Menu items are not implemented yet — the collection is a starter.

## Usage

```ts
import { buildConfig } from 'payload'
import { VWPayloadPluginMenus } from '@vitrailweb/payload-plugin-menus'

export default buildConfig({
  plugins: [VWPayloadPluginMenus()],
  // ...
})
```

## Options

All optional — defaults shown as comments:

```ts
VWPayloadPluginMenus({
  // Access per operation. Defaults: read = anyone,
  // create/update/delete = authenticated.
  access: { read, create, update, delete },

  // Keeps the collection schema but disables runtime behavior (default: false).
  disabled: false,
})
```

## Development

From the monorepo root:

```bash
pnpm install
pnpm dev:menus                                        # dev Payload app with this plugin
pnpm vitest run packages/payload-plugin-menus/test    # unit tests
pnpm vitest run dev/configs/menus                     # integration tests
pnpm --filter @vitrailweb/payload-plugin-menus build  # build to dist/
```

See the [root README](../../README.md) for the release flow.
