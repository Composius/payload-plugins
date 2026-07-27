# @composius/payload-plugin-home-nav

A [Payload CMS](https://payloadcms.com) plugin that makes the admin's way home
obvious:

- a translated **"Home" label next to the icon** in the app header (the
  `admin.components.graphics.Icon` slot — the step-nav already links it to the
  dashboard), and
- a **"Home" link at the top of the collapsible nav sidebar** (prepended to
  `admin.components.beforeNavLinks`, styled like the built-in nav links), and
- the **app's version at the bottom of the nav sidebar**, just above the logout
  button (appended to `admin.components.afterNavLinks`).

Both are **server components** resolved against the admin language. The label
defaults to the plugin's bundled translations ("Home" / "Accueil") and can be
overridden with a plain string or a per-language record. A custom icon the
project already configured through `admin.components.graphics.Icon` is kept
and rendered next to the label — the plugin re-registers it under
`admin.dependencies` so it stays in the import map.

The version is read from the nearest `package.json` found by walking up from
the working directory (the app root under `next dev`, `next build` and
`next start`), so it tracks the host app's own version. Pass `versionNumber`
to show something else — a build ref, for instance. When no version can be
resolved (a standalone bundle shipping no `package.json`, or one without a
`version` field), nothing is rendered and Payload's logger warns once.

## Requirements

The following dependencies are required to be installed in your project before using this plugin:

- `@payloadcms/ui` (`^3.84.1`)
- `payload` (`^3.84.1`)
- `react` (`^19.0.0`)

```bash
pnpm add @payloadcms/ui payload react
```

## Usage

```ts
import { buildConfig } from 'payload'
import { ComposiusPayloadPluginHomeNav } from '@composius/payload-plugin-home-nav'

export default buildConfig({
  plugins: [
    ComposiusPayloadPluginHomeNav(),
  ],
  // ...
})
```

Point "Home" somewhere else (e.g. the public site) or change the label:

```ts
ComposiusPayloadPluginHomeNav({
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
| `version`   | `boolean`       | show the app version above the logout button (default `true`)                               |
| `versionLabel` | `LocalizedText` | the label in front of the version number. Default: "Version" from the bundled translations |
| `versionNumber` | `string`    | the version to show. Default: the host app's `package.json` version                         |
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
pnpm --filter @composius/payload-plugin-home-nav build     # build to dist/
```

See the [root README](../../README.md) for the release flow.
