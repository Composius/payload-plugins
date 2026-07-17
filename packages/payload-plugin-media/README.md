# @vitrailweb/payload-plugin-media

A [Payload CMS](https://payloadcms.com) plugin that adds a `media` upload
collection: images are converted to WebP (quality 90), the original is capped
at 2560px wide, a set of responsive sizes is generated, filenames get a random
suffix so they are unique, and an optional storage key prefix
(`<folder>/<year>/<month>`) is set for cloud storage plugins.

## Fields

| Field | Type   | Notes                       |
| ----- | ------ | --------------------------- |
| `alt` | `text` | alternative text for images |

Plus the file fields Payload adds to upload collections (`filename`,
`mimeType`, `sizes`, …).

## Uploads

- Only images are accepted (`mimeTypes: ['image/*']`).
- Every upload is converted to WebP at quality 90; the stored original is
  resized down to at most 2560px wide (never enlarged).
- Default generated sizes: `thumbnail` (300), `small` (600), `medium` (900),
  `large` (1400) and `og` (1200×630, center crop, for social sharing). The
  admin thumbnail uses the `thumbnail` size when present, otherwise the first
  configured size.
- With `randomSuffix` (default), a `beforeOperation` hook renames uploads to
  `filename-<randomsuffix>.ext` so names never collide.
- With the `prefix` option, a `beforeValidate` hook writes a storage key
  prefix to `data.prefix` on create. Cloud storage plugins (e.g.
  `@payloadcms/storage-s3`) read this `prefix` field when building the object
  key, so objects end up under e.g. `<folder>/<year>/<month>/`. Without such a
  storage plugin the value is simply ignored.

## Requirements

The following dependencies are required to be installed in your project before using this plugin:

- `payload` (`^3.84.1`)

```bash
pnpm add payload
```

## Usage

```ts
import { buildConfig } from 'payload'
import { VWPayloadPluginMedia } from '@vitrailweb/payload-plugin-media'

export default buildConfig({
  plugins: [
    VWPayloadPluginMedia({
      prefix: { folder: process.env.R2_FOLDER },
    }),
  ],
  // ...
})
```

## Options

All optional — defaults shown as comments:

```ts
VWPayloadPluginMedia({
  // Access per operation. Defaults: read = anyone,
  // create/update/delete = authenticated.
  access: { read, create, update, delete },

  // Generated image sizes (default: thumbnail/small/medium/large/og,
  // see above).
  imageSizes: [{ name: 'thumbnail', width: 300 }],

  // Storage key prefix for cloud storage plugins (default: disabled).
  // Either a full string used as-is…
  prefix: 'uploads/site',
  // …or parts joined as <folder>/<year>/<month>/<day>.
  // year and month default to true, day to false.
  prefix: { folder: 'site', year: true, month: true, day: false },

  // Rename uploads to filename-<randomsuffix>.ext (default: true).
  randomSuffix: true,

  // Directory for locally stored files when no cloud storage plugin is
  // used (default: Payload's default, `media` next to the config file).
  staticDir: path.resolve(dirname, 'media'),

  // Keeps the collection schema but disables runtime behavior (default: false).
  disabled: false,
})
```

## Development

From the monorepo root:

```bash
pnpm install
pnpm dev:media                                        # dev Payload app with this plugin
pnpm vitest run packages/payload-plugin-media/test    # unit tests
pnpm vitest run dev/configs/media                     # integration tests
pnpm --filter @vitrailweb/payload-plugin-media build  # build to dist/
```

See the [root README](../../README.md) for the release flow.
