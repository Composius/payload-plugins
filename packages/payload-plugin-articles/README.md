# @composius/payload-plugin-articles

A [Payload CMS](https://payloadcms.com) plugin that adds an `articles` collection with drafts (autosave), live preview, and SEO fields from `@payloadcms/plugin-seo`, plus a nestable `categories` collection (breadcrumbs from `@payloadcms/plugin-nested-docs`) and an `authors` collection for organizing and attributing articles.

## Collections

### `articles`

| Field         | Type           | Notes                                     |
| ------------- | -------------- | ----------------------------------------- |
| `title`       | `text`         | required, used as admin title             |
| `slug`        | `text`         | auto-generated from title, unique         |
| `category`    | `relationship` | relates to `categories`, rendered as a checkbox tree |
| `editor`      | `relationship` | relates to `users`; defaults to the creating user, editable afterwards |
| `author`      | `relationship` | optional, relates to `authors`            |
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

  // Authors access per operation. Defaults: read = anyone,
  // create/update/delete = authenticated.
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
