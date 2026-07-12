# payload-vw-articles

A [Payload CMS](https://payloadcms.com) plugin that adds an `articles` collection.

## Fields

| Field         | Type       | Notes                        |
| ------------- | ---------- | ---------------------------- |
| `title`       | `text`     | required, used as title      |
| `slug`        | `text`     | unique, indexed              |
| `coverImage`  | `upload`   | relates to `media`           |
| `content`     | `richText` |                              |
| `publishedAt` | `date`     |                              |

> The plugin expects a `media` upload collection to exist in your config for the `coverImage` field.

## Usage

```ts
import { buildConfig } from 'payload'
import { payloadVwArticles } from 'payload-vw-articles'

export default buildConfig({
  plugins: [payloadVwArticles()],
  // ...
})
```

### Options

```ts
payloadVwArticles({
  // Keeps the collection in the config (for schema/migration consistency)
  // but you can use this flag to disable runtime behavior.
  disabled: false,
})
```

## Development

```bash
pnpm install
pnpm dev            # start the dev Payload app
pnpm test:int       # integration tests (vitest)
pnpm test:e2e       # e2e tests (playwright)
pnpm build          # build to dist/
```
