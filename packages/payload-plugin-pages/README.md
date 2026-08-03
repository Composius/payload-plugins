# @composius/payload-plugin-pages

A [Payload CMS](https://payloadcms.com) plugin that adds a `pages` collection with drafts (autosave), live preview, and SEO fields from `@payloadcms/plugin-seo`.

## Fields

| Field         | Type       | Notes                                     |
| ------------- | ---------- | ----------------------------------------- |
| `title`       | `text`     | required, used as admin title             |
| `slug`        | `text`     | auto-generated from title, unique         |
| `coverImage`  | `upload`   | relates to `media`                        |
| `content`     | `richText` | only with `content: true` (see below)     |
| `layout`      | `blocks`   | only when blocks are passed (see below)   |
| `publishedAt` | `date`     | auto-set on first publish                 |
| `meta`        | `group`    | SEO title/description/image/preview       |

> Requires a `media` upload collection in the host config.

## Blocks

A page is title and cover image until you give it blocks. Pass them and a
`layout` blocks field appears:

```ts
ComposiusPayloadPluginPages({ blocks: [Hero, CallToAction] })
```

Blocks registered on the config are named by slug instead, so one definition is
shared by every field that uses it rather than copied into each:

```ts
export default buildConfig({
  blocks: [Hero],
  plugins: [ComposiusPayloadPluginPages({ blockReferences: ['hero'] })],
})
```

`blockReferences` also takes block objects, and the two options combine — pass
`blocks` alongside `blockReferences` and the inline blocks join the references
on the same field, since Payload allows a blocks field only one of the two
lists.

### Prose

Rich text is a block like any other. `contentBlock()` builds it — the same
lexical editor the standalone field used, with the plugin's toolbar features:

```ts
import { ComposiusPayloadPluginPages, contentBlock } from '@composius/payload-plugin-pages'

// inline…
ComposiusPayloadPluginPages({ blocks: [contentBlock(), Hero] })

// …or registered once and referenced by slug
export default buildConfig({
  blocks: [contentBlock(), Hero],
  plugins: [ComposiusPayloadPluginPages({ blockReferences: ['content', 'hero'] })],
})
```

It is a factory, not a shared object: Payload marks a block sanitized in place,
so each config needs its own copy.

For a fixed `content` richText field on the document instead, pass
`content: true`. The two are independent — a collection can have both — but they
store their text in different places (a column on `pages`, versus rows in a
`pages_blocks_content` table), so moving from one to the other on a populated
collection needs a migration that copies the values across. Nothing is migrated
automatically, and a dropped field takes its column with it.

The default meta description reads whichever is present: the `content` field
when the collection has one, otherwise the first content block in the layout.

## Cache revalidation

Publishing, unpublishing or deleting a page invalidates the collection's Next.js
cache tags, so a front end built on `cacheComponents` picks the change up. Tag a
`'use cache'` function with the matching tag and the admin panel does the rest:

```ts
// app/[slug]/page.tsx
import { cacheTag } from 'next/cache'
import { pageTag, PAGES_TAG } from '@composius/payload-plugin-pages/tags'
import { getPayload } from 'payload'
import config from '@payload-config'

const getPage = async (slug: string) => {
  'use cache'
  cacheTag(pageTag(slug))

  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'pages',
    where: { slug: { equals: slug } },
  })
  return docs[0]
}
```

The tags, all exported from `@composius/payload-plugin-pages/tags` — an entry
point that imports neither `payload` nor `next`:

| Tag              | Covers                                                |
| ---------------- | ----------------------------------------------------- |
| `PAGES_TAG`      | every page — listings, navigation, sitemaps, search    |
| `pageTag(slug)`  | one page, the way a `/[slug]` route addresses it       |
| `pageIdTag(id)`  | one page, by id                                        |

A save invalidates the collection tag and both tags of the document, plus the
former slug when a page is renamed — a page that changes address leaves a cache
entry behind at the old one.

Autosaved drafts are skipped: nothing about them is public. The hooks run when a
page is published, when a published page is saved again, and when one is
unpublished or deleted.

By default the tags expire at once, so the first visitor after a save is served
a fresh page. Pass `revalidate: { profile: 'max' }` for stale-while-revalidate
instead: nobody waits, but the visitor right after a save — usually the editor
checking their own work — sees the previous version.

Revalidation is a no-op wherever Next.js is not running (a migration, a seeding
script, a test run), and never fails a write. To skip it for one operation, set
`context.disableRevalidate`:

```ts
await payload.update({
  collection: 'pages',
  id,
  data,
  context: { disableRevalidate: true },
})
```

## Requirements

The following dependencies are required to be installed in your project before using this plugin:

- `@payloadcms/plugin-seo` (`^3.84.1`)
- `@payloadcms/richtext-lexical` (`^3.84.1`)
- `payload` (`^3.84.1`)

```bash
pnpm add @payloadcms/plugin-seo @payloadcms/richtext-lexical payload
```

`next` (`^16.0.0`) is an optional peer dependency: it is only needed for cache
revalidation, and any Payload app already running inside Next.js has it.

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

  // Blocks of the `layout` field: defined inline, and/or referenced by slug
  // from `config.blocks`. No field is added when both are empty (the default).
  blocks: [contentBlock(), Hero],
  blockReferences: ['hero'],

  // Adds a fixed `content` richText field to the document. Off by default:
  // prose is a block, via contentBlock().
  content: false,

  // Front-end URL of a page, used for (live) preview and SEO.
  // Default: `${NEXT_PUBLIC_SERVER_URL || SERVER_URL}/${slug}` (pages live at the site root)
  pageUrl: (slug) => string,

  // SEO meta group + generate endpoints. `true` (default) uses built-in
  // generate functions; pass an object to override any of them; `false` disables.
  seo: { generateTitle, generateDescription, generateImage, generateURL },

  // Next.js cache invalidation on save and delete (default: enabled).
  // Pass false to drop the hooks entirely.
  revalidate: {
    // revalidateTag's second argument: a cacheLife profile name, or an
    // inline { expire } in seconds (default: { expire: 0 }).
    profile: { expire: 0 },

    // Extra tags to invalidate alongside the built-in ones.
    tags: ({ collection, doc, operation, previousDoc }) => ['sitemap'],

    // Called instead of the default debug log when a revalidation fails.
    onError: (error, event) => {},
  },

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
