# @composius/payload-plugin-import-wordpress

Imports WordPress posts into Payload via the WordPress REST API: content,
categories, authors, featured images and in-content images. Images are fetched
at their original size (and resized by your media collection), uploaded only
once even when reused across posts, and internal links are rewritten (with
redirection rules created for the rest — one prefix rule per permalink folder
rather than one per post). Imports run on the Payload jobs queue and are
**idempotent and resumable**, writing a full report onto each job document.

By default it targets the collections from
[`@composius/payload-plugin-articles`](../payload-plugin-articles) (`articles`,
`categories`, `authors`) and a `media` uploads collection.

## Collections

This plugin adds two collections (grouped under **WordPress import**):

| Collection         | Purpose                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `wp-import-jobs`   | The import "form" and report surface. Creating a document starts an import run.              |
| `wp-import-records`| Source→target mappings that make imports idempotent, resumable and image-deduplicating.     |

### `wp-import-jobs` fields

The edit form is organized into one tab per import step:

| Tab                | Fields                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| Configuration      | `sourceUrl`, `credentials` (`username` + `applicationPassword`, optional), `dateFrom`/`dateTo`, `limit`, `dryRun`, `resume` |
| Authors            | `authorsReport` (read-only) — authors imported by this job.                                                  |
| Categories         | `categoriesReport` (read-only) — categories imported, hierarchy preserved.                                   |
| Media              | `mediaReport` (read-only) — images uploaded + how many were reused (deduped).                                |
| Posts              | `postsReport` (read-only) — posts imported and remaining.                                                    |
| Links & redirects  | `linksReport` (read-only) — every internal link: rewritten / redirect created / unresolved.                  |
| Report             | `runs` + `progress` + `errorsReport` (read-only) — run history, live counts and per-item errors.             |

`status`, `startedAt` and `finishedAt` sit in the sidebar (read-only).

**Run history**: a job can run several times (resume/retry). Each run gets a
number; `runs` lists every run with its status, timestamps and a final progress
snapshot, and every reported item (post, category, author, media, link, error)
carries the `run` that produced it. A resume **merges** with the previous
reports instead of overwriting them — only entries from dry runs are dropped
(they were plans, not imports).

**Credentials** are optional: a WordPress username + [application password](https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/)
(Users → Profile → Application Passwords). When set, requests are authenticated
with HTTP Basic auth, which unlocks non-public data — notably **author emails**
(fetched via `?context=edit`), so the `users` author strategy can use real
addresses instead of synthesized ones. The password is stored in plain text on
the job document — delete the job (or clear the field) once the import is done.

## What gets imported

- **Posts** (published only) → the target content collection, preserving the
  WordPress slug and publish date, created as published.
- **Categories** → the categories collection, preserving the parent hierarchy.
  Each post is assigned its **primary (first)** category.
- **Authors** → the users collection by default (matched/created by email,
  linked via `editor`), or the authors collection, or a fixed user.
- **Featured + in-content images** → the media collection, original size,
  de-duplicated across posts. When the embed is missing or a stub, the featured
  image is re-fetched from the media endpoint; when a post has no featured image
  at all, the first in-content image is promoted to the cover (see
  `firstImageAsCover`), and a cover that also leads the content is removed from
  it so the hero doesn't render twice.
- **SEO meta** (when the target collection has a `meta` group) — `meta.title`
  from the post title, `meta.image` from the cover image, and
  `meta.description` from the excerpt (see `excerptToSeoDescription`).
- **Links** — internal links to imported posts are rewritten; the old permalinks
  are covered by redirection rules (one **prefix** rule per permalink folder
  where possible); anything unresolvable is listed in the report.

## Requirements

This plugin expects the following to be installed and configured in your project:

- `payload` (`^3.84.1`)
- `@payloadcms/richtext-lexical` (`^3.84.1`) — the target content field's editor.
- `@payloadcms/ui` (`^3.84.1`) and `react` (`^19.0.0`) — the masked
  application-password input in the admin form.
- `@composius/payload-plugin-redirections` (`^1.0.0`) — required only when
  `redirections` is enabled (the default); optional otherwise.

```bash
pnpm add @composius/payload-plugin-import-wordpress @payloadcms/richtext-lexical @payloadcms/ui react @composius/payload-plugin-redirections
```

You also need a target content collection with a rich text field (e.g. the
`articles` collection from `@composius/payload-plugin-articles`) and a `media`
uploads collection. Imports run on the Payload **jobs queue**, which this
plugin schedules for you by default (see `autoRun`).

## Usage

```ts
import { buildConfig } from 'payload'
import { ComposiusPayloadPluginArticles } from '@composius/payload-plugin-articles'
import { ComposiusPayloadPluginMedia } from '@composius/payload-plugin-media'
import { ComposiusPayloadPluginImportWordpress } from '@composius/payload-plugin-import-wordpress'

export default buildConfig({
  // ...
  plugins: [
    ComposiusPayloadPluginMedia(),
    ComposiusPayloadPluginArticles({ authors: true }),
    ComposiusPayloadPluginImportWordpress(),
  ],
})
```

Then, in the admin panel, create a **WordPress import** document with the site
URL (optionally a date range, a limit, or `dryRun`) and watch `status`,
`progress` and `report` update. Or trigger programmatically:

```bash
curl -X POST /api/wp-import/start \
  -H 'Content-Type: application/json' \
  -b '<auth cookie>' \
  -d '{ "sourceUrl": "https://example.com", "dryRun": true }'
# → { "jobId": "..." }  then poll:
curl /api/wp-import/status/<jobId>
```

## Options

| Option                    | Type                                             | Default                          | Description                                                                                 |
| ------------------------- | ------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------- |
| `access`                  | per-operation access                             | authenticated                    | Access control for the jobs/records collections and the endpoints.                          |
| `collections`             | `{ articles, categories, media, authors, users }`| `articles`/`categories`/`media`/`authors`/`users` | Target collection slugs.                                                  |
| `articleUrl`              | `(slug?) => string`                              | `…/articles/<slug>`              | Builds the front-end URL used for redirects and rewritten links.                            |
| `authorMapping`           | `{ strategy, defaultUserId, syntheticEmailDomain }` | `{ strategy: 'users', syntheticEmailDomain: 'imported.invalid' }` | `users` (default), `authors`, or `fixed`. WordPress's public REST API hides author emails, so `users` synthesizes `<author-slug>@<syntheticEmailDomain>`; set your own domain, or `false` to skip creating such users (falls back to `defaultUserId` and reports the author). |
| `excerptToSeoDescription` | boolean                                          | `true`                           | Map the WordPress excerpt onto the article SEO `meta.description`.                           |
| `firstImageAsCover`       | boolean                                          | `true`                           | When a post has no usable featured image, promote the first in-content image to the cover and remove it from the content. |
| `redirections`            | boolean \| `{ manage, pluginOptions, slug, status, strategy }` | `true`             | Create redirection rules, preferring one **prefix** rule per permalink folder. The collection comes from `@composius/payload-plugin-redirections` unless your app already provides it (auto-detected) — see below. |
| `fieldMap`                | article field overrides                          | `title`/`slug`/`content`/`coverImage`/`category`/`publishedAt` | Article field names the importer writes to.                    |
| `autoRun`                 | boolean \| `{ cron, queue }`                     | `true`                           | Auto-process queued imports on a schedule (every minute on the `default` queue). Pass `{ cron, queue }` to customize, or `false` to run the jobs queue yourself. |
| `dryRunPageLimit`         | number                                           | `1`                              | REST pages a dry run samples.                                                                |
| `request`                 | `{ concurrency, timeoutMs, userAgent }`          | `{ concurrency: 5, timeoutMs: 30000 }` | HTTP tuning for WordPress fetches and image downloads.                                 |
| `disabled`                | boolean                                          | `false`                          | Keep the collections (schema consistency) but skip endpoints, the redirections plugin and auto-run.       |

### Redirections: prefix rules, not one per post

Redirection rules come from
[`@composius/payload-plugin-redirections`](../payload-plugin-redirections),
whose `prefix` match type appends the leftover path segments to its
destination. So a whole blog collapses into **one rule**:

| WordPress permalinks           | Rule created                    | Result                        |
| ------------------------------ | ------------------------------- | ----------------------------- |
| `/blog/hello`, `/blog/world`, … | `/blog` → `/articles` (prefix)  | `/blog/hello` → `/articles/hello` |
| `/2021/06/a`, `/2021/06/b`      | `/2021/06` → `/articles` (prefix) | one rule per year/month     |

Two cases fall back to an **exact** rule, because a prefix rule would be wrong:

- the slug changed during the import (the folder mapping no longer holds);
- the permalink sits at the site root (`/hello`) — a prefix rule on `/` would
  swallow every URL on the site.

Set `redirections.strategy: 'exact'` for one rule per post instead, and
`redirections.status` (default `'301'`) to change the HTTP status.

### Using it alongside your own redirections plugin

If your app already runs `ComposiusPayloadPluginRedirections`, this plugin
**reuses that collection** — it detects it and adds nothing, so your own options
win and imported posts still get their rules.

Detection only sees collections registered *before* this plugin, so list yours
first:

```ts
plugins: [
  ComposiusPayloadPluginRedirections({ hidden: false }),
  ComposiusPayloadPluginImportWordpress(),
]
```

If you'd rather keep it after this plugin, opt out explicitly to avoid
`DuplicateCollection: Collection slug already in use: "redirections"`:

```ts
plugins: [
  ComposiusPayloadPluginImportWordpress({ redirections: { manage: false } }),
  ComposiusPayloadPluginRedirections(),
]
```

When this plugin does register the collection, `redirections.pluginOptions` is
forwarded to it (`access`, `endpoint`, `hidden`, `slug`):

```ts
ComposiusPayloadPluginImportWordpress({
  redirections: {
    pluginOptions: { hidden: true },
    slug: 'redirections',
    status: '308',
  },
})
```

## Notes

- Only the **primary (first)** WordPress category is assigned to each post
  (the `articles.category` relationship is single); the others are still created
  in the categories collection and noted in the report.
- The original image is recovered by stripping WordPress's `-WxH` size suffix;
  if the original 404s the importer falls back to the URL WordPress provided.
- Re-running (or toggling `resume`) skips already-imported items via
  `wp-import-records`, so imports are safe to repeat.
