---
name: plugin-creator
description: Create/scaffold a new Payload plugin in this monorepo. Use when asked to "create a plugin", "add a new plugin", "scaffold a plugin", or "make a plugin which…". Creates the package (src, tests, translations, README), the dev suite config, and updates the root README, root package.json, and publish workflow.
---

# Plugin creator

Scaffolds a new plugin `packages/payload-plugin-<name>/` plus its dev suite
`dev/configs/<name>/`, following the conventions already in this repo.
All paths below are relative to the repo root.

`<name>` is short, lowercase kebab-case (`menus`, `umami`, `custom-panel`,
`home-nav`). The exported factory is `ComposiusPayloadPlugin<PascalName>` and its
options type is `ComposiusPayloadPlugin<PascalName>Config` (e.g. `ComposiusPayloadPluginMenus`
/ `ComposiusPayloadPluginHomeNavConfig`).

## Step 0 — pick a template plugin

Do NOT invent structure. Copy the closest existing plugin and adapt:

| New plugin is… | Copy from | Build tool |
|---|---|---|
| A collection (fields, hooks, access), no admin UI components | `packages/payload-plugin-menus` | tsup, `index` + `exports/tags` entries |
| Server-only integration (hooks/endpoints, no collection, no UI) | `packages/payload-plugin-axiom` | tsup, single `index` entry |
| Admin UI, server components only (panels, nav/header slots — no state/effects of its own; interactive leaves like `Link`/`PayloadIcon` come from `@payloadcms/ui`) | `packages/payload-plugin-custom-panel` or `-home-nav` | tsup with `index` + `exports/rsc` entries, no client bundle, no banner |
| Admin UI with own client components (state, hooks, charts) | `packages/payload-plugin-umami` | tsup with `index` + `exports/client` (+ `exports/rsc`) entries, `"use client"` banner on the client bundle |
| Content collection with drafts/live-preview/SEO reusing shared editor features | `packages/payload-plugin-articles` or `-pages` | tsup, bundles `@composius/payload-plugin-shared-components` (private, never published) into its own dist |

Any plugin adding a collection a front end renders also needs the cache
revalidation wiring — see the subsection in Step 1.

Read the template's `package.json`, `tsup.config.ts`, and
`tsconfig.json` before writing anything.

## Step 1 — the package: `packages/payload-plugin-<name>/`

Required files:

```
package.json
README.md
tsconfig.json
tsup.config.ts
src/index.ts
src/translations/index.ts
src/translations/en.ts
src/translations/fr.ts
test/unit.spec.ts
```

Plus, when the plugin adds a collection a front end renders (see the cache
revalidation subsection below):

```
src/tags.ts
src/exports/tags.ts
```

### package.json rules (copy template, then edit)

- `"name": "@composius/payload-plugin-<name>"`, `"version": "0.1.0"`,
  one-line `"description"` (it also goes in the root README table).
- `"repository"` keeps the repo URL and sets
  `"directory": "packages/payload-plugin-<name>"`.
- Dev-time `exports`/`main`/`types` point at `./src/index.ts`;
  `publishConfig` swaps every entry to `./dist/…`. If the plugin has admin
  components, mirror the template's subpath exports (`./rsc` for
  custom-panel/home-nav, `./client` + `./rsc` for umami) in BOTH the
  top-level `exports` and `publishConfig.exports`.
- `"files": ["dist"]`, `peerDependencies` on `payload: "^3.84.1"`
  (plus `@payloadcms/ui`, `react`, etc. if UI). Match the exact versions
  the template pins in `devDependencies`. A plugin doing cache revalidation
  adds a `./tags` export and an optional `next` peer — see that subsection.
- Keep the `engines` block from the template.

### src/index.ts

Plugin factory pattern (see `packages/payload-plugin-menus/src/index.ts`):

- `export const ComposiusPayloadPlugin<PascalName> = (pluginOptions = {}) => (config: Config): Config => { … }`
- Export the config type: `export type ComposiusPayloadPlugin<PascalName>Config = { … }`
  with JSDoc on every option; include `disabled?: boolean`.
- **Even when `pluginOptions.disabled` is true, still push collections/fields
  before returning** — the database schema must stay consistent for
  migrations (this comment exists in every plugin; keep it).
- Access defaults: reuse the `anyone`/`authenticated` pattern
  (`packages/payload-plugin-menus/src/defaults.ts`) with a
  per-operation `access` option override.

### Cache revalidation — collections a front end renders

A plugin whose documents appear on a Next.js site must invalidate that site's
cache tags when one is saved or deleted, or editors publish into a void. Do NOT
write the hooks by hand — `@composius/payload-plugin-shared-components` owns
them (`src/revalidate/`). Working examples: menus (no drafts), pages (drafts),
articles (drafts + related collections).

The target is a `cacheComponents` front end, so this is tag-only: `revalidateTag`
and `cacheTag`, never `revalidatePath`.

In the collection factory, spread `revalidateHooks` into `hooks` — it returns an
`afterChange` and an `afterDelete`, or nothing when revalidation is off:

```ts
import { revalidateHooks } from '@composius/payload-plugin-shared-components'

hooks: {
  ...revalidateHooks({ collection: '<slug>', drafts: true, fields: ['slug'] }, revalidate),
  // the collection's own hooks still go here — the spread only adds two keys
}
```

- `drafts: true` **only** when the collection sets `versions.drafts`. It skips
  draft-only saves, which autosave repeats every few seconds, and lets through
  publishes and unpublishes.
- `fields` lists what addresses one document on the front end besides its id —
  `['slug']` usually, `['name']` for menus.
- `related` names collections that embed this one, invalidated alongside it.
  Categories and authors pass `related: ['articles']`, because an article
  carries its category's and author's name. Don't wire the reverse: a page
  listing a category's articles claims both tags itself.

In `src/index.ts`, take the option and switch it off with the plugin — a
disabled plugin keeps its schema but must not cause side effects:

```ts
import type { RevalidateOptions } from '@composius/payload-plugin-shared-components'

revalidate?: false | RevalidateOptions

const revalidate =
  pluginOptions.disabled || pluginOptions.revalidate === false
    ? false
    : (pluginOptions.revalidate ?? {})
```

Re-export `RevalidateEvent`, `RevalidateOptions` and `RevalidateProfile` from
`src/index.ts` — the shared package is private, so consumers have no other way
to name the types of the option they are passing.

Publish the tags the front end claims with `cacheTag` in `src/tags.ts`, built
from the shared helpers so both sides can never drift:

```ts
import { collectionTag, fieldTag, idTag } from '@composius/payload-plugin-shared-components/tags'

export const <PLURAL>_TAG = collectionTag('<slug>')
export const <singular>Tag = (slug: string): string => fieldTag('<slug>', 'slug', slug)
export const <singular>IdTag = (id: number | string): string => idTag('<slug>', id)
```

Re-export them from `src/exports/tags.ts` — a `/tags` entry point importing
neither `payload` nor `next`, so page code builds a tag without loading the CMS
— and from `src/index.ts` for convenience.

Four things beyond the source have to line up:

- **`package.json`** — `"./tags"` in BOTH `exports` and
  `publishConfig.exports`; `"@composius/payload-plugin-shared-components":
  "workspace:*"` and `next` (pinned like the template) in `devDependencies`;
  and `next` as an **optional** peer, `"next": "^16.0.0"` in `peerDependencies`
  plus `"peerDependenciesMeta": { "next": { "optional": true } }`. Optional
  because the plugin works without Next — revalidation just becomes a no-op.
- **`tsconfig.json`** — `paths` mapping both
  `@composius/payload-plugin-shared-components` and its `/tags` subpath to the
  shared source (copy menus'). tsup resolves the inlined types through it.
- **`tsup.config.ts`** — an `exports/tags` entry, and `external: [/^next(\/|$)/]`
  on every entry so esbuild does not follow the dynamic `next/cache.js` import
  and bundle the framework into `dist/`. Verify after building:
  `grep -c "next/dist" dist/index.js` must print `0`.
- **`README.md`** — a "Cache revalidation" section: a `cacheTag` usage snippet,
  a table of the exported tags, the profile trade-off, and the
  `context.disableRevalidate` escape hatch. Copy the shape from
  `packages/payload-plugin-pages/README.md`.

Options worth documenting on the plugin's `revalidate` object, all optional:
`profile` (`revalidateTag`'s second argument, default `{ expire: 0 }`), `tags`
(extra tags per event), `onError`.

### Translations — `src/translations/`

`en.ts` is the source of truth; `fr.ts` is typed against it. Always:

- `en.ts`: `export const en = { … }` — nested plain object of strings.
- `fr.ts`: `import type { Translation } from './index.js'` then
  `export const fr: Translation = { … }`.
- `index.ts`: exports `type Translation = typeof en` plus re-exports.

Then two consumption patterns — no hardcoded UI strings either way:

- **Collection/field labels** (menus pattern): `index.ts` also exports the
  `label()` helper building `{ en, fr }` records; use
  `label((t) => t.<section>.<key>)` for every `label`/`admin.description`.
- **Component-rendered text** (custom-panel/home-nav pattern): components
  resolve against `i18n.language` at render time with a
  `Record<string, Translation>` map falling back to `en`. If an option lets
  users override text, use the shared `LocalizedText`
  (`string | Record<string, string>`) + `resolveLocalizedText()` shape from
  `packages/payload-plugin-custom-panel/src/localized.ts` (copy it — it is
  not a shared package).

### Tests — `test/unit.spec.ts`

Vitest, no Payload instance. Pattern from
`packages/payload-plugin-menus/test/unit.spec.ts`: apply the plugin to a
minimal `Config`, then assert the collection exists, field names, admin
settings (`useAsTitle`, `defaultColumns`), access defaults, option
behavior, and the `disabled` schema-consistency rule.

With revalidation, also assert the tag strings, that the hooks are registered
by default, and that `revalidate: false` and `disabled: true` both remove them
(menus' `describe('revalidation')` block). Assert on `afterDelete`, not
`afterChange`: other plugins append their own `afterChange` hooks — on articles'
categories, `nestedDocsPlugin` adds two — so its length is not a signal.

The hook behavior itself (draft gate, renames, failure handling) is covered once
in `packages/payload-plugin-shared-components/test/revalidate.spec.ts`, which
mocks `next/cache.js`. Don't duplicate it per plugin.

### README.md

Same shape as `packages/payload-plugin-menus/README.md`:
title `# @composius/payload-plugin-<name>`, one-line intro, a Fields
table (if it adds collections), a Requirements section, a Usage section
with a `buildConfig` snippet, and an Options table documenting every
config option.

The Requirements section goes right before Usage and lists every
`peerDependency` (with its version range) as dependencies required to be
installed in the project before using the plugin, followed by a
`pnpm add …` command installing them all — see
`packages/payload-plugin-menus/README.md` for the exact wording. Keep it
in sync with `peerDependencies` in `package.json`. Optional peers go in a
sentence after the `pnpm add`, not in the list — `next` is only needed for
cache revalidation and any Payload app already has it.

## Step 2 — dev suite: `dev/configs/<name>/`

Four files, copied from `dev/configs/menus/` and adapted:

- `config.ts` — `buildDevConfig({ dirname, plugins: [ComposiusPayloadPlugin<PascalName>({ … })], seed })`
  from `../shared.js`. Wire plugin options to env vars if the plugin needs
  external services (see `dev/configs/umami/config.ts`).
- `seed.ts` — always seed `devUser` from `../../helpers/credentials.js`
  (guarded by a `payload.count`), then seed one or two sample docs for the
  plugin, also count-guarded so restarts don't duplicate.
- `int.spec.ts` — for plugins with collections/endpoints:
  `getPayload({ config })` in `beforeAll`, `payload.destroy()` in `afterAll`;
  test real CRUD through the Local API (pattern:
  `dev/configs/menus/int.spec.ts`). Runs against `:memory:` SQLite because
  `NODE_ENV=test`. For pure admin-UI plugins, no Payload instance: await the
  config and assert the sanitized `admin.components` entries (pattern:
  `dev/configs/custom-panel/int.spec.ts` or `home-nav`).
- `tsconfig.json` — exactly:

```json
{
  "extends": "../../tsconfig.json",
  "include": ["./**/*.ts"],
  "exclude": []
}
```

Then register the suite in the `loaders` map of `dev/payload.config.ts`:

```ts
'<name>': () => import('./configs/<name>/config.js'),
```

Also register the suite in the per-suite import-map aggregator
`dev/app/(payload)/admin/importMap.js` — add the import and the map entry
(alphabetically):

```ts
import { importMap as <camelName> } from './importMaps/<name>.js'
// …then inside the importMaps object:
'<name>': <camelName>,
```

This is required for **every** suite, not just ones with admin UI components:
the aggregator returns `importMaps[DEV_SUITE] ?? {}`, and the admin dashboard
always renders built-in components (e.g. `CollectionCards`). A suite missing
from the aggregator (or without a generated `importMaps/<name>.js`) fails at
runtime with `getFromImportMap: PayloadComponent not found in importMap`. The
`importMaps/<name>.js` file is created by `generate:importmap:<name>` in Step 5.

## Step 3 — root package.json

Add, keeping each script group alphabetized:

- `"dev:<name>": "cross-env DEV_SUITE=<name> next dev dev --turbo"`
- `"generate:types:<name>": "cross-env DEV_SUITE=<name> pnpm payload generate:types"`
- `"generate:importmap:<name>": "cross-env DEV_SUITE=<name> pnpm payload generate:importmap"`
  — add this for **every** suite (see Step 2: even non-UI suites need a
  generated import map for the built-in admin components).
- Append `&& tsc --noEmit -p dev/configs/<name>` to the `typecheck` script.
- devDependencies: `"@composius/payload-plugin-<name>": "workspace:*"`
  (sorted with the other `@composius/*` entries).

Then run `pnpm install` to link the workspace package.

## Step 4 — root README + publish workflow

- Add a row to the package table in `README.md`. **The format matters** —
  `release.sh` updates the version with a regex that anchors on
  `packages/payload-plugin-<name>)` followed by `| <semver> |`:

```
| [@composius/payload-plugin-<name>](packages/payload-plugin-<name>) | 0.1.0 | <description> |
```

- Add a `./release.sh <name> patch` line to the "Publish" section's code
  block in `README.md`.
- Add `<name>` to the `package` choice options in
  `.github/workflows/publish.yml` (workflow_dispatch input).

## Step 5 — generate artifacts and verify

```bash
pnpm install
pnpm generate:types:<name>            # writes dev/configs/<name>/payload-types.ts
pnpm generate:importmap:<name>        # every suite — writes dev/app/(payload)/admin/importMaps/<name>.js
pnpm test:unit                        # vitest run packages
pnpm vitest run dev/configs/<name>    # just the new suite's int tests
pnpm typecheck
pnpm --filter @composius/payload-plugin-<name> build   # dist/ builds cleanly
```

Do NOT run eslint (it hangs in this repo). Verification is tests +
typecheck + build.

To try it interactively: `pnpm dev:<name>` → http://localhost:3000/admin,
log in with `dev@payloadcms.com` / `test` (seeded by `seed.ts`). The suite
uses a local SQLite file `dev/configs/<name>/payload.db`, created
automatically and already gitignored (`/dev/configs/*/*.db`).

## Gotchas

- Root `tsconfig.json` **excludes** `dev/configs/*/payload-types.ts` and
  `int.spec.ts` — per-suite generated types conflict in one program. That's
  why each suite has its own tsconfig and its own entry in the root
  `typecheck` script. Don't "fix" the exclusion.
- `buildDevConfig` sets `ROOT_DIR` and the import-map `baseDir` to `dev/`, and
  points `admin.importMap.importMapFile` at a **per-suite** file
  `dev/app/(payload)/admin/importMaps/<name>.js`. The hand-written aggregator
  `dev/app/(payload)/admin/importMap.js` picks the right one per `DEV_SUITE`
  (returning `{}` for an unknown suite). **Every** suite therefore needs both
  its generated `importMaps/<name>.js` (via `generate:importmap:<name>`) and an
  entry in that aggregator — even plugins with no admin components of their own,
  because the dashboard always renders built-ins like `CollectionCards`. Missing
  either one fails at runtime with `PayloadComponent not found in importMap`.
  (This replaces the old one-shared-file behavior; don't generate into
  `importMap.js` directly.)
- tsup drops the `"use client"` directive when bundling — client entries
  need `banner: { js: "'use client'" }` (see
  `packages/payload-plugin-umami/tsup.config.ts`).
- Admin components are registered as
  `{ path: '@composius/payload-plugin-<name>/rsc', exportName, serverProps }`.
  Server components receive the admin template's `ServerProps` (`i18n`,
  `payload`, `user`, …) merged with the config's own `serverProps`
  (`RenderServerComponent` does the merge). `serverProps` never reach the
  browser, so they can carry access functions or component configs;
  `clientProps` must be serializable.
- When a plugin takes over a slot a project may already use (e.g.
  `admin.components.graphics.Icon`), capture the existing value and re-render
  it inside the plugin component via `RenderServerComponent` (from
  `@payloadcms/ui/elements/RenderServerComponent`) with a `Fallback` — don't
  discard it. Pattern: home-nav's `HomeNavIcon`.
- `generate:importmap` only scans the known component slots and
  `admin.dependencies`. A component reference tucked into `serverProps` (like
  the captured icon above) is invisible to it and fails at runtime with
  "PayloadComponent not found in importMap". Register such references in
  `config.admin.dependencies` with a `path` normalized to the runtime lookup
  key — `path#exportName`, `#default` when there is no export name (see
  home-nav's `src/index.ts`).
- Styling admin slot components: emit an inline `<style>` from the component
  (custom-panel/home-nav pattern). Unlayered rules win over Payload's
  `@layer payload-default` styles, so no `!important`. Two traps home-nav
  hit: Payload universal rules like `.step-nav * { display: block }` make the
  inline `<style>` element render its CSS as text (hide it back with
  `display: none`), and some slots are fixed-size boxes (`.step-nav__home` is
  18×18px) that silently clip added content. Reuse Payload's own classes
  (e.g. `nav__link`, `nav__link-label`) where injected items should match
  built-in ones, and always eyeball `pnpm dev:<name>` after touching an
  admin slot — tests and typecheck don't catch rendering issues.
- `@composius/payload-plugin-shared-components` is private and must never
  become a `dependency`/`peerDependency` of a published plugin — articles,
  pages and menus bundle it into their own `dist/` via tsup. It stays a
  `devDependency` plus a `tsconfig.json` `paths` mapping; that pairing is what
  makes tsup inline the JS and the types instead of emitting an import of a
  package nobody can install.
- Bare `next/<subpath>` specifiers fail to typecheck under this repo's
  `moduleResolution: nodenext` — Next ships no `exports` map, so TypeScript
  resolves `next/cache` to a non-existent `next/cache/index.d.ts`. Add the
  extension: `import('next/cache.js')` resolves to the same file for Node and
  every bundler, and to its declarations for TypeScript. Leave a comment saying
  why.
- Revalidation must never fail a write. `afterChange` runs inside the write's
  transaction, so a throw would roll the document back; `revalidateTag` throws
  whenever it runs outside a Next.js request, which is routine (seeds,
  migrations, `pnpm test:int`). The shared helper already swallows this and
  logs at `debug` — don't add a `try`/`throw` of your own around it, and don't
  raise the log level: a bulk import would flood the output.
- `updateTag` is not usable from these hooks even though it would give
  read-your-writes: it throws outside a Server Action, and Payload hooks run in
  a route handler. That is why the default profile is `{ expire: 0 }` rather
  than the `'max'` Next.js recommends — otherwise the editor who just hit
  Publish is served the stale page.
- Publishing itself is manual (`./release.sh <name> patch`) and is NOT part
  of scaffolding — first-time npm publish needs the Trusted Publisher setup
  described in the root README ("Adding a plugin", steps 7–9).
