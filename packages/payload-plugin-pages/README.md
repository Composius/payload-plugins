# @composius/payload-plugin-pages

A [Payload CMS](https://payloadcms.com) plugin that adds a `pages` collection with drafts (autosave), live preview, and SEO fields from `@payloadcms/plugin-seo`.

## Fields

| Field         | Type       | Notes                                     |
| ------------- | ---------- | ----------------------------------------- |
| `title`       | `text`     | required, used as admin title             |
| `slug`        | `text`     | auto-generated from title, unique         |
| `coverImage`  | `upload`   | relates to `media`                        |
| `content`     | `richText` |                                           |
| `publishedAt` | `date`     | auto-set on first publish                 |
| `meta`        | `group`    | SEO title/description/image/preview       |

> Requires a `media` upload collection in the host config.

## Requirements

The following dependencies are required to be installed in your project before using this plugin:

- `@payloadcms/plugin-seo` (`^3.84.1`)
- `@payloadcms/richtext-lexical` (`^3.84.1`)
- `payload` (`^3.84.1`)

```bash
pnpm add @payloadcms/plugin-seo @payloadcms/richtext-lexical payload
```

## Usage

```ts
import { buildConfig } from 'payload'
import { ComposiusPayloadPluginPages } from '@composius/payload-plugin-pages'

export default buildConfig({
  plugins: [ComposiusPayloadPluginPages()],
  // ...
})
```

## Options

All optional — defaults shown as comments:

```ts
ComposiusPayloadPluginPages({
  // Access per operation. Defaults: read = published or authenticated,
  // create/update/delete = authenticated.
  access: { read, create, update, delete },

  // Front-end URL of a page, used for (live) preview and SEO.
  // Default: `${NEXT_PUBLIC_SERVER_URL}/${slug}` (pages live at the site root)
  pageUrl: (slug) => string,

  // SEO meta group + generate endpoints. `true` (default) uses built-in
  // generate functions; pass an object to override any of them; `false` disables.
  seo: { generateTitle, generateDescription, generateImage, generateURL },

  // Keeps the collection schema but disables runtime behavior (default: false).
  disabled: false,
})
```

## Development

From the monorepo root:

```bash
pnpm install
pnpm dev:pages                                        # dev Payload app with this plugin
pnpm vitest run packages/payload-plugin-pages/test    # unit tests
pnpm vitest run dev/configs/pages                     # integration tests
pnpm --filter @composius/payload-plugin-pages build  # build to dist/
```

See the [root README](../../README.md) for the release flow.
