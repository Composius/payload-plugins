---
name: plugin-creator
description: Create/scaffold a new Payload plugin in this monorepo. Use when asked to "create a plugin", "add a new plugin", "scaffold a plugin", or "make a plugin which…". Creates the package (src, tests, translations, README), the dev suite config, and updates the root README, root package.json, and publish workflow.
---

# Plugin creator

Scaffolds a new plugin `packages/payload-plugin-<name>/` plus its dev suite
`dev/configs/<name>/`, following the conventions already in this repo.
All paths below are relative to the repo root.

`<name>` is short, lowercase, singular-word-ish (`menus`, `umami`, `axiom`).
The exported factory is `VWPayloadPlugin<PascalName>` and its options type is
`VWPayloadPlugin<PascalName>Config` (e.g. `VWPayloadPluginMenus` /
`VWPayloadPluginMenusConfig`).

## Step 0 — pick a template plugin

Do NOT invent structure. Copy the closest existing plugin and adapt:

| New plugin is… | Copy from | Build tool |
|---|---|---|
| A collection (fields, hooks, access), no admin UI components | `packages/payload-plugin-menus` | swc + tsc (`.swcrc`, `build:swc`/`build:types` scripts) |
| Server-only integration (hooks/endpoints, no collection, no UI) | `packages/payload-plugin-axiom` | tsup, single `index` entry |
| Has admin UI (React components, dashboard widgets) | `packages/payload-plugin-umami` | tsup with `index` + `exports/client` (+ `exports/rsc`) entries, `"use client"` banner on the client bundle |
| Content collection with drafts/live-preview/SEO reusing shared editor features | `packages/payload-plugin-articles` or `-pages` | tsup, bundles `@vitrailweb/payload-plugin-shared-components` (private, never published) into its own dist |

Read the template's `package.json`, `tsup.config.ts`/`.swcrc`, and
`tsconfig.json` before writing anything.

## Step 1 — the package: `packages/payload-plugin-<name>/`

Required files:

```
package.json
README.md
tsconfig.json
tsup.config.ts        (or .swcrc for the menus/swc variant)
src/index.ts
src/translations/index.ts
src/translations/en.ts
src/translations/fr.ts
test/unit.spec.ts
```

### package.json rules (copy template, then edit)

- `"name": "@vitrailweb/payload-plugin-<name>"`, `"version": "0.1.0"`,
  one-line `"description"` (it also goes in the root README table).
- `"repository"` keeps the repo URL and sets
  `"directory": "packages/payload-plugin-<name>"`.
- Dev-time `exports`/`main`/`types` point at `./src/index.ts`;
  `publishConfig` swaps every entry to `./dist/…`. If the plugin has
  client components, mirror umami's `./client` (and `./rsc`) subpath
  exports in BOTH the top-level `exports` and `publishConfig.exports`.
- `"files": ["dist"]`, `peerDependencies` on `payload: "^3.84.1"`
  (plus `@payloadcms/ui`, `react`, etc. if UI). Match the exact versions
  the template pins in `devDependencies`.
- Keep the `engines` block from the template.

### src/index.ts

Plugin factory pattern (see `packages/payload-plugin-menus/src/index.ts`):

- `export const VWPayloadPlugin<PascalName> = (pluginOptions = {}) => (config: Config): Config => { … }`
- Export the config type: `export type VWPayloadPlugin<PascalName>Config = { … }`
  with JSDoc on every option; include `disabled?: boolean`.
- **Even when `pluginOptions.disabled` is true, still push collections/fields
  before returning** — the database schema must stay consistent for
  migrations (this comment exists in every plugin; keep it).
- Access defaults: reuse the `anyone`/`authenticated` pattern
  (`packages/payload-plugin-menus/src/defaults.ts`) with a
  per-operation `access` option override.

### Translations — `src/translations/`

`en.ts` is the source of truth; `fr.ts` is typed against it. Copy the exact
pattern from `packages/payload-plugin-menus/src/translations/`:

- `en.ts`: `export const en = { … }` — nested plain object of strings.
- `fr.ts`: `import type { Translation } from './index.js'` then
  `export const fr: Translation = { … }`.
- `index.ts`: exports `type Translation = typeof en` and the `label()`
  helper that builds `{ en, fr }` label records. Use
  `label((t) => t.<section>.<key>)` for every collection/field `label`
  and `admin.description` — no hardcoded UI strings.

### Tests — `test/unit.spec.ts`

Vitest, no Payload instance. Pattern from
`packages/payload-plugin-menus/test/unit.spec.ts`: apply the plugin to a
minimal `Config`, then assert the collection exists, field names, admin
settings (`useAsTitle`, `defaultColumns`), access defaults, option
behavior, and the `disabled` schema-consistency rule.

### README.md

Same shape as `packages/payload-plugin-menus/README.md`:
title `# @vitrailweb/payload-plugin-<name>`, one-line intro, a Fields
table (if it adds collections), a Usage section with a `buildConfig`
snippet, and an Options table documenting every config option.

## Step 2 — dev suite: `dev/configs/<name>/`

Four files, copied from `dev/configs/menus/` and adapted:

- `config.ts` — `buildDevConfig({ dirname, plugins: [VWPayloadPlugin<PascalName>({ … })], seed })`
  from `../shared.js`. Wire plugin options to env vars if the plugin needs
  external services (see `dev/configs/umami/config.ts`).
- `seed.ts` — always seed `devUser` from `../../helpers/credentials.js`
  (guarded by a `payload.count`), then seed one or two sample docs for the
  plugin, also count-guarded so restarts don't duplicate.
- `int.spec.ts` — `getPayload({ config })` in `beforeAll`,
  `payload.destroy()` in `afterAll`; test real CRUD through the Local API
  (pattern: `dev/configs/menus/int.spec.ts`). Runs against `:memory:`
  SQLite because `NODE_ENV=test`.
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

## Step 3 — root package.json

Add, keeping each script group alphabetized:

- `"dev:<name>": "cross-env DEV_SUITE=<name> next dev dev --turbo"`
- `"generate:types:<name>": "cross-env DEV_SUITE=<name> pnpm payload generate:types"`
- Only if the plugin has admin UI components:
  `"generate:importmap:<name>": "cross-env DEV_SUITE=<name> pnpm payload generate:importmap"`
- Append `&& tsc --noEmit -p dev/configs/<name>` to the `typecheck` script.
- devDependencies: `"@vitrailweb/payload-plugin-<name>": "workspace:*"`
  (sorted with the other `@vitrailweb/*` entries).

Then run `pnpm install` to link the workspace package.

## Step 4 — root README + publish workflow

- Add a row to the package table in `README.md`. **The format matters** —
  `release.sh` updates the version with a regex that anchors on
  `packages/payload-plugin-<name>)` followed by `| <semver> |`:

```
| [@vitrailweb/payload-plugin-<name>](packages/payload-plugin-<name>) | 0.1.0 | <description> |
```

- Add `<name>` to the `package` choice options in
  `.github/workflows/publish.yml` (workflow_dispatch input).

## Step 5 — generate artifacts and verify

```bash
pnpm install
pnpm generate:types:<name>            # writes dev/configs/<name>/payload-types.ts
pnpm generate:importmap:<name>        # only if the plugin has UI components
pnpm test:unit                        # vitest run packages
pnpm vitest run dev/configs/<name>    # just the new suite's int tests
pnpm typecheck
pnpm --filter @vitrailweb/payload-plugin-<name> build   # dist/ builds cleanly
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
- `buildDevConfig` sets `ROOT_DIR` and the import-map `baseDir` to `dev/`
  so all suites share `dev/app/(payload)/admin/importMap.js`. New UI
  plugins must regenerate that shared file (`generate:importmap:<name>`).
- tsup drops the `"use client"` directive when bundling — client entries
  need `banner: { js: "'use client'" }` (see
  `packages/payload-plugin-umami/tsup.config.ts`).
- `@vitrailweb/payload-plugin-shared-components` is private and must never
  become a `dependency`/`peerDependency` of a published plugin — articles
  and pages bundle it into their own `dist/` via tsup.
- Publishing itself is manual (`./release.sh <name> patch`) and is NOT part
  of scaffolding — first-time npm publish needs the Trusted Publisher setup
  described in the root README ("Adding a plugin", steps 7–9).
