# @composius/payload-plugin-articles

A [Payload CMS](https://payloadcms.com) plugin that adds an `articles` collection with drafts (autosave), live preview, and SEO fields from `@payloadcms/plugin-seo`, plus a nestable `categories` collection (breadcrumbs from `@payloadcms/plugin-nested-docs`) for organizing articles, and an opt-in `authors` collection for attributing them.

## Collections

### `articles`

| Field         | Type           | Notes                                     |
| ------------- | -------------- | ----------------------------------------- |
| `title`       | `text`         | required, used as admin title             |
| `slug`        | `text`         | auto-generated from title, unique         |
| `category`    | `relationship` | relates to `categories`, rendered as a checkbox tree |
| `editor`      | `relationship` | relates to `users`; defaults to the creating user, editable afterwards |
| `author`      | `relationship` | only with `authors: true`, relates to `authors` |
| `coverImage`  | `upload`       | relates to `media`                        |
| `content`     | `richText`     |                                           |
| `publishedAt` | `date`         | auto-set on first publish                 |
| `meta`        | `group`        | SEO title/description/image/preview       |

> Requires a `media` upload collection and a `users` auth collection in the host config.

The `editor` defaults to the user who creates the article (via a `beforeChange`
field hook) but can be reassigned to any existing user at any time. Point it at a
different users collection with the `usersSlug` option. In the articles list, the
`editor` column resolves the user's `name`, then the users collection's title
field (`useAsTitle`), then their `email`. This pairs with
[`@composius/payload-plugin-auth`](../payload-plugin-auth), whose `users`
collection has a required `name` and `useAsTitle: 'name'`.

### `authors`

Opt-in — enable it with the `authors: true` option. When disabled (the default),
neither the collection nor the `author` field on articles is registered, and
articles are attributed through `editor` alone.

| Field         | Type       | Notes                                                        |
| ------------- | ---------- | ------------------------------------------------------------ |
| `name`        | `text`     | required, used as admin title                                |
| `picture`     | `upload`   | optional, relates to `media`                                 |
| `contact`     | `text`     | optional; email, website, or any other contact detail       |
| `biography`   | `textarea` | optional                                                     |

When no `picture` is set, the admin sidebar previews a deterministic
[`boring-avatars`](https://github.com/boringdesigners/boring-avatars) "beam"
avatar generated from the author name. A front-end can reproduce the same avatar
from the name with the `boring-avatars` `<Avatar variant="beam" />` component.

### `categories`

| Field         | Type           | Notes                                              |
| ------------- | -------------- | -------------------------------------------------- |
| `name`        | `text`         | required, used as admin title                      |
| `slug`        | `text`         | auto-generated from name, unique                   |
| `parent`      | `relationship` | relates to `categories` (nested categories)        |
| `description` | `textarea`     |                                                    |
| `breadcrumbs` | `array`        | read-only, populated by `plugin-nested-docs` hooks |

On articles, `category` is rendered by a custom sidebar component
(`CategoryFieldClient` from the `/client` export): a checkbox per category,
with children indented under their parent. Selection is exclusive — checking
a category unchecks the previous one, and checking it again clears it.

Categories are nestable: pick a `parent` and `@payloadcms/plugin-nested-docs` keeps
`breadcrumbs` (doc, label, url) up to date on save, including on all descendants.
The parent picker excludes the category itself and its descendants.

## Cache revalidation

Publishing, unpublishing or deleting a document invalidates the Next.js cache
tags of all three collections, so a front end built on `cacheComponents` picks
the change up. Tag a `'use cache'` function with the matching tag and the admin
panel does the rest:

```ts
// app/articles/[slug]/page.tsx
import { cacheTag } from 'next/cache'
import { articleTag, ARTICLES_TAG } from '@composius/payload-plugin-articles/tags'
import { getPayload } from 'payload'
import config from '@payload-config'

const getArticle = async (slug: string) => {
  'use cache'
  cacheTag(articleTag(slug))

  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'articles',
    where: { slug: { equals: slug } },
  })
  return docs[0]
}
```

The tags, all exported from `@composius/payload-plugin-articles/tags` — an entry
point that imports neither `payload` nor `next`:

| Tag                    | Covers                                                  |
| ---------------------- | ------------------------------------------------------- |
| `ARTICLES_TAG`         | every article — listings, archives, feeds, sitemaps      |
| `articleTag(slug)`     | one article, the way a `/articles/[slug]` route does     |
| `articleIdTag(id)`     | one article, by id                                       |
| `CATEGORIES_TAG`       | every category                                           |
| `categoryTag(slug)`    | one category, by slug                                    |
| `categoryIdTag(id)`    | one category, by id                                      |
| `AUTHORS_TAG`          | every author (only with `authors: true`)                 |
| `authorIdTag(id)`      | one author, by id — authors have no slug                 |

A save invalidates the collection tag and both tags of the document, plus the
former slug when a document is renamed — a page that changes address leaves a
cache entry behind at the old one.

Articles carry the name of their category and author, so saving one of those
invalidates `ARTICLES_TAG` too. The reverse is not true, and does not need to
be: a page listing the articles of a category claims both tags itself.

```ts
const getCategoryArticles = async (slug: string) => {
  'use cache'
  // The category's own data, and the articles inside it.
  cacheTag(categoryTag(slug), ARTICLES_TAG)
  // ...
}
```

Autosaved drafts are skipped: nothing about them is public. The hooks run when an
article is published, when a published article is saved again, and when one is
unpublished or deleted. Categories and authors have no drafts, so every save
counts.

By default the tags expire at once, so the first visitor after a save is served
a fresh page. Pass `revalidate: { profile: 'max' }` for stale-while-revalidate
instead: nobody waits, but the visitor right after a save — usually the editor
checking their own work — sees the previous version.

Revalidation is a no-op wherever Next.js is not running (a migration, a seeding
script, a test run), and never fails a write. To skip it for one operation — a
bulk import, say — set `context.disableRevalidate`:

```ts
await payload.update({
  collection: 'articles',
  id,
  data,
  context: { disableRevalidate: true },
})
```

## Requirements

The following dependencies are required to be installed in your project before using this plugin:

- `@payloadcms/plugin-nested-docs` (`^3.84.1`)
- `@payloadcms/plugin-seo` (`^3.84.1`)
- `@payloadcms/richtext-lexical` (`^3.84.1`)
- `@payloadcms/ui` (`^3.84.1`)
- `payload` (`^3.84.1`)
- `react` (`^19.0.0`)

```bash
pnpm add @payloadcms/plugin-nested-docs @payloadcms/plugin-seo @payloadcms/richtext-lexical @payloadcms/ui payload react
```

`next` (`^16.0.0`) is an optional peer dependency: it is only needed for cache
revalidation, and any Payload app already running inside Next.js has it.

## Usage

```ts
import { buildConfig } from 'payload'
import { ComposiusPayloadPluginArticles } from '@composius/payload-plugin-articles'

export default buildConfig({
  plugins: [ComposiusPayloadPluginArticles()],
  // ...
})
```

## Options

All optional — defaults shown as comments:

```ts
ComposiusPayloadPluginArticles({
  // Articles access per operation. Defaults: read = published or authenticated,
  // create/update/delete = authenticated.
  access: { read, create, update, delete },

  // Categories access per operation. Defaults: read = anyone,
  // create/update/delete = authenticated.
  categoriesAccess: { read, create, update, delete },

  // Authors collection + `author` field on articles (default: false).
  authors: false,

  // Authors access per operation, when `authors` is enabled.
  // Defaults: read = anyone, create/update/delete = authenticated.
  authorsAccess: { read, create, update, delete },

  // Users collection the article `editor` field relates to. Default: 'users'.
  usersSlug: 'users',

  // Field-level access controlling who may change an article's `editor`.
  // Default: any authenticated user.
  editorUpdateAccess: ({ req: { user } }) => Boolean(user),

  // Front-end URL of an article, used for (live) preview and SEO.
  // Default: `${NEXT_PUBLIC_SERVER_URL}/articles/${slug}`
  articleUrl: (slug) => string,

  // SEO meta group + generate endpoints. `true` (default) uses built-in
  // generate functions; pass an object to override any of them; `false` disables.
  seo: { generateTitle, generateDescription, generateImage, generateURL },

  // Next.js cache invalidation on save and delete, for all three collections
  // (default: enabled). Pass false to drop the hooks entirely.
  revalidate: {
    // revalidateTag's second argument: a cacheLife profile name, or an
    // inline { expire } in seconds (default: { expire: 0 }).
    profile: { expire: 0 },

    // Extra tags to invalidate alongside the built-in ones. `collection` tells
    // the three collections apart.
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
pnpm dev:articles                                        # dev Payload app with this plugin
pnpm vitest run packages/payload-plugin-articles/test    # unit tests
pnpm vitest run dev/configs/articles                     # integration tests
pnpm test:e2e                                            # e2e tests (playwright)
pnpm --filter @composius/payload-plugin-articles build  # build to dist/
```

See the [root README](../../README.md) for the release flow.
