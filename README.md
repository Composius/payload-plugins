# Vitrail Web — Payload plugins

pnpm monorepo of [Payload CMS](https://payloadcms.com) plugins.

| Package                                                              | Description                        |
| -------------------------------------------------------------------- | ---------------------------------- |
| [@vitrailweb/payload-plugin-articles](packages/payload-plugin-articles) | Articles collection with drafts, live preview, and SEO |
| [@vitrailweb/payload-plugin-menus](packages/payload-plugin-menus)       | Menus collection                   |

## Layout

- `packages/*` — the publishable plugins. Each one exports its source (`src/index.ts`) during development and swaps to `dist/` on publish via `publishConfig`.
- `dev/` — a single shared Next + Payload dev app. `dev/payload.config.ts` picks a per-plugin config from `dev/configs/<suite>/config.ts` based on the required `DEV_SUITE` env var.

## Development

```bash
pnpm install

pnpm dev:articles   # dev app with the articles plugin → http://localhost:3000/admin
pnpm dev:menus      # dev app with the menus plugin

pnpm build          # build every package to dist/
pnpm test:unit      # unit tests (packages/*/test)
pnpm test:int       # integration tests (dev/configs/*/int.spec.ts)
pnpm test:e2e       # playwright (articles suite)
pnpm lint
```

Regenerate Payload artifacts per suite:

```bash
pnpm generate:types:articles
pnpm generate:types:menus
pnpm generate:importmap:articles
```

## Adding a plugin

1. Copy an existing package under `packages/payload-plugin-<name>` (package.json name/version, `src/`, `test/`).
2. Add `dev/configs/<name>/{config.ts,seed.ts,int.spec.ts}` using `buildDevConfig()` from `dev/configs/shared.ts`.
3. Register the suite in the `loaders` map of `dev/payload.config.ts`.
4. Add `dev:<name>` and `generate:types:<name>` scripts to the root `package.json`, plus `workspace:*` devDependency on the new package.
5. Add the short name to the `package` choices in `.github/workflows/publish.yml`.
6. Add the code
7. For publishing for the first time, login to npm `npm login` and run `pnpm --filter @vitrailweb/payload-plugin-<name> publish --access public --no-git-checks`


## Publish

Each package is released independently:

```bash
# commit everything
cd packages/payload-plugin-<name>
pnpm version patch --no-git-tag-version           # or minor/major
# or modify directly in the package.json of the plugin
# commit and push
```

Then create a GitHub release with tag `<name>@<version>` (e.g. `articles@1.0.5`, `menus@0.1.0`) — the publish workflow builds and publishes that package to npm. The workflow can also be dispatched manually with a package choice.

### Test a package locally

```bash
pnpm --filter @vitrailweb/payload-plugin-<name> build
cd packages/payload-plugin-<name> && pnpm pack
```
