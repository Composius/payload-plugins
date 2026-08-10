# @composius/payload-plugin-media

A [Payload CMS](https://payloadcms.com) plugin that adds a `media` upload
collection: images and their generated sizes are converted to WebP, the
original is capped at 2560px wide, a set of responsive sizes is generated,
filenames get a random suffix so they are unique, and an optional storage key
prefix (`<folder>/<year>/<month>`) is set for cloud storage plugins.

## Fields

| Field | Type   | Notes                       |
| ----- | ------ | --------------------------- |
| `alt` | `text` | alternative text for images |

Plus the file fields Payload adds to upload collections (`filename`,
`mimeType`, `sizes`, …).

## Uploads

- Only images are accepted (`mimeTypes: ['image/*']`), up to `maxFileSize`
  (5 MB by default). Payload has no per-collection size limit, so a
  `beforeOperation` hook rejects oversized uploads with a 413 before any image
  processing happens.

  That hook runs once the file has been received, so it is worth pairing with
  Payload's app-wide parser limit, which aborts a request mid-transfer:

  ```ts
  buildConfig({
    upload: {
      limits: { fileSize: 25 * 1024 * 1024 }, // headroom over maxFileSize
      abortOnLimit: true, // without it, Payload truncates instead of failing
      responseOnLimit: 'File is too large.', // replaces Payload's own wording
    },
    // ...
  })
  ```

  Give that limit **headroom over `maxFileSize`** rather than matching it: the
  parser aborts before any hook runs, so a matching value means every oversized
  upload gets Payload's generic `responseOnLimit` message ("File size limit has
  been reached") and never reaches the plugin's — which names the actual limit
  and follows the admin language. With headroom, files just over `maxFileSize`
  get the good message, and only genuinely huge ones are cut off mid-transfer.

  Two more things to know: the limit is app-wide, so it caps every upload
  collection — size it for the largest one. And `abortOnLimit` matters: without
  it Payload truncates the file at the limit and passes it on as if complete.
  The plugin rejects truncated files whatever you set, so a partial image can
  never be stored.
- Every upload is converted to WebP — the stored original at quality 90, the
  generated sizes at quality 80 — and the original is resized down to at most
  2560px wide (never enlarged). Animated GIFs keep their frames. Formats sharp
  cannot re-encode (SVG…) pass through untouched, without sizes.
- AVIF uploads are converted as well. Keeping them as AVIF is not worth it:
  Payload re-runs sharp on AVIF input no matter what, at a quality that cannot
  be configured alongside this conversion (sharp's default of 50, which halves
  the file of an AVIF encoded at quality 80), and encoding six AVIFs per upload
  takes seconds — 27s for a 4000×3000 photo against 1.3s for the same photo as
  WebP. AVIF `og` images are also rejected by most social crawlers.
- AVIF is the one format converted by a `beforeOperation` hook rather than by
  `formatOptions`, because Payload decodes the uploaded file once per output
  and AVIF decoding is expensive: converting it up front means paying that
  once (~3s instead of ~12s for a 4000×3000 upload).
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
import { ComposiusPayloadPluginMedia } from '@composius/payload-plugin-media'

export default buildConfig({
  plugins: [
    ComposiusPayloadPluginMedia({
      prefix: { folder: process.env.R2_FOLDER },
    }),
  ],
  // ...
})
```

## Options

All optional — defaults shown as comments:

```ts
ComposiusPayloadPluginMedia({
  // Access per operation. Defaults: read = anyone,
  // create/update/delete = authenticated.
  access: { read, create, update, delete },

  // Generated image sizes (default: thumbnail/small/medium/large/og,
  // see above).
  imageSizes: [{ name: 'thumbnail', width: 300 }],

  // Largest accepted upload, in bytes (default: 5 MB).
  maxFileSize: 5 * 1024 * 1024,

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
pnpm --filter @composius/payload-plugin-media build  # build to dist/
```

See the [root README](../../README.md) for the release flow.
