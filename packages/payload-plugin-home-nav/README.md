# @vitrailweb/payload-plugin-home-nav

A [Payload CMS](https://payloadcms.com) plugin that makes the admin's way home
obvious:

- a translated **"Home" label next to the icon** in the app header (the
  `admin.components.graphics.Icon` slot — the step-nav already links it to the
  dashboard), and
- a **"Home" link at the top of the collapsible nav sidebar** (prepended to
  `admin.components.beforeNavLinks`, styled like the built-in nav links).

Both are **server components** resolved against the admin language. The label
defaults to the plugin's bundled translations ("Home" / "Accueil") and can be
overridden with a plain string or a per-language record. A custom icon the
project already configured through `admin.components.graphics.Icon` is kept
and rendered next to the label — the plugin re-registers it under
`admin.dependencies` so it stays in the import map.

## Usage

```ts
import { buildConfig } from 'payload'
import { VWPayloadPluginHomeNav } from '@vitrailweb/payload-plugin-home-nav'

export default buildConfig({
  plugins: [
    VWPayloadPluginHomeNav(),
  ],
  // ...
})
```

Point "Home" somewhere else (e.g. the public site) or change the label:

```ts
VWPayloadPluginHomeNav({
  href: '/',
  label: { en: 'Back to site', fr: 'Retour au site' },
})
```

> Registers admin components, so run `payload generate:importmap` after adding
> the plugin.

## Options

| Option      | Type            | Notes                                                                                      |
| ----------- | --------------- | ------------------------------------------------------------------------------------------ |
| `href`      | `string`        | where the nav-sidebar "Home" link points. Default: the admin dashboard (`routes.admin`)    |
| `label`     | `LocalizedText` | the label, plain or per-language. Default: "Home" / "Accueil" from the bundled translations |
| `iconLabel` | `boolean`       | show the label next to the app-header icon (default `true`)                                 |
| `navLink`   | `boolean`       | add the link at the top of the nav sidebar (default `true`)                                 |
| `disabled`  | `boolean`       | leaves the config untouched                                                                 |

`LocalizedText` is `string | Record<string, string>` — a per-language record
is resolved as: exact admin-language match, then `en`, then the first value.

## Development

From the monorepo root:

```bash
pnpm install
pnpm generate:importmap:home-nav                            # register the components
pnpm dev:home-nav                                           # dev Payload app with this plugin
pnpm vitest run packages/payload-plugin-home-nav/test       # unit tests
pnpm vitest run dev/configs/home-nav                        # integration tests
pnpm --filter @vitrailweb/payload-plugin-home-nav build     # build to dist/
```

See the [root README](../../README.md) for the release flow.
