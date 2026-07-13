# @vitrailweb/payload-plugin-articles

A [Payload CMS](https://payloadcms.com) plugin that adds an `articles` collection with drafts (autosave), live preview, and SEO fields from `@payloadcms/plugin-seo`.

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

## Usage

```ts
import { buildConfig } from 'payload'
import { VWPayloadPluginArticles } from '@vitrailweb/payload-plugin-articles'

export default buildConfig({
  plugins: [VWPayloadPluginArticles()],
  // ...
})
```

## Options

All optional — defaults shown as comments:

```ts
VWPayloadPluginArticles({
  // Access per operation. Defaults: read = published or authenticated,
  // create/update/delete = authenticated.
  access: { read, create, update, delete },

  // Front-end URL of an article, used for (live) preview and SEO.
  // Default: `${NEXT_PUBLIC_SERVER_URL}/articles/${slug}`
  articleUrl: (slug) => string,

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
pnpm dev:articles                                        # dev Payload app with this plugin
pnpm vitest run packages/payload-plugin-articles/test    # unit tests
pnpm vitest run dev/configs/articles                     # integration tests
pnpm test:e2e                                            # e2e tests (playwright)
pnpm --filter @vitrailweb/payload-plugin-articles build  # build to dist/
```

See the [root README](../../README.md) for the release flow.
