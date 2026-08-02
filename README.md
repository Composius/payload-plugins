# Composius — Payload plugins

pnpm monorepo of [Payload CMS](https://payloadcms.com) plugins.

| Package                                                              | Version | Description                        |
| -------------------------------------------------------------------- | ------- | ---------------------------------- |
| [@composius/payload-plugin-articles](packages/payload-plugin-articles) | 1.9.0 | Articles and categories collections with drafts, live preview, and SEO |
| [@composius/payload-plugin-auth](packages/payload-plugin-auth)         | 1.2.0 | Users auth collection with configurable roles and role-based access helpers |
| [@composius/payload-plugin-axiom](packages/payload-plugin-axiom)       | 1.0.0 | Axiom plugin                       |
| [@composius/payload-plugin-custom-panel](packages/payload-plugin-custom-panel) | 1.0.0 | Configurable panel (site title, message, link buttons) above the admin dashboard |
| [@composius/payload-plugin-health](packages/payload-plugin-health)     | 1.0.0 | Health check endpoint with optional custom checks |
| [@composius/payload-plugin-home-nav](packages/payload-plugin-home-nav) | 1.1.0 | Translated "Home" label next to the admin navbar icon and a Home link at the top of the nav sidebar |
| [@composius/payload-plugin-import-wordpress](packages/payload-plugin-import-wordpress) | 1.1.1 | Import WordPress posts, categories, authors and images into Payload (idempotent, resumable, with a link/redirect report) |
| [@composius/payload-plugin-media](packages/payload-plugin-media)       | 1.0.0 | Configurable media uploads collection (access, unique filenames, storage prefix, image sizes) |
| [@composius/payload-plugin-menus](packages/payload-plugin-menus)       | 1.2.0 | Menus collection                   |
| [@composius/payload-plugin-pages](packages/payload-plugin-pages)       | 1.1.1 | Pages collection with drafts, live preview, and SEO |
| [@composius/payload-plugin-redirections](packages/payload-plugin-redirections) | 1.0.2 | Redirections collection with exact, prefix and regex URL matching, plus a Next.js proxy helper |
| [@composius/payload-plugin-umami](packages/payload-plugin-umami)       | 1.0.0 | Umami widget |
| [@composius/payload-plugin-shared-components](packages/payload-plugin-shared-components) | 1.0.0 (private) | Private — editor features, SEO field, access defaults, and Next.js cache revalidation hooks inlined into the plugins at build time |

## Layout

- `packages/*` — the publishable plugins. Each one exports its source (`src/index.ts`) during development and swaps to `dist/` on publish via `publishConfig`. `payload-plugin-shared-components` is private: articles, pages and menus bundle it into their own `dist/` with tsup, so it is never published.

- `dev/` — a single shared Next + Payload dev app. `dev/payload.config.ts` picks a per-plugin config from `dev/configs/<suite>/config.ts` based on the required `DEV_SUITE` env var.

## Next.js cache revalidation

The articles, pages and menus plugins keep a Next.js `cacheComponents` front end
in step with the CMS: saving or deleting a document invalidates its cache tags
through `revalidateTag`. Each plugin publishes the tags to claim with `cacheTag`
from a dependency-free `/tags` entry point — see the
[articles](packages/payload-plugin-articles#cache-revalidation),
[pages](packages/payload-plugin-pages#cache-revalidation) and
[menus](packages/payload-plugin-menus#cache-revalidation) READMEs.

The hooks live in `packages/payload-plugin-shared-components/src/revalidate/`.
`next` is an optional peer dependency loaded through a dynamic import, so
revalidation is a no-op — never an error — wherever Next.js is not running.

## Development

```bash
pnpm install

pnpm dev:articles   # dev app with the articles plugin → http://localhost:3000/admin
pnpm dev:menus      # dev app with the menus plugin
pnpm dev:pages      # dev app with the pages plugin

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
pnpm generate:types:pages
pnpm generate:importmap:articles
pnpm generate:importmap:pages
```

## Adding a plugin

1. Copy an existing package under `packages/payload-plugin-<name>` (package.json name/version, `src/`, `test/`).
2. Add `dev/configs/<name>/{config.ts,seed.ts,int.spec.ts}` using `buildDevConfig()` from `dev/configs/shared.ts`.
3. Register the suite in the `loaders` map of `dev/payload.config.ts`.
4. Add `dev:<name>` and `generate:types:<name>` scripts to the root `package.json`, plus `workspace:*` devDependency on the new package.
5. Add the short name to the `package` choices in `.github/workflows/publish.yml`.
6. Add the code and commit.
7. For publishing for the first time, login to npm `npm login` and run `pnpm --filter @composius/payload-plugin-<name> publish --no-git-checks`.
8. Go to npmjs.com and in the packages of the account, go to Settings and add a Trusted Publisher.
9. Continue with the next section, as local publish is not trusted. And for local testing in another project run `npm logout` first.


## Publish

Each package is released independently.

First commit everthing, then:

```bash
# Run release.sh script with the short name of the plugin and patch|minor|major
# The first time do:
# chmod +x release.sh
./release.sh articles patch
./release.sh pages patch
./release.sh media patch
./release.sh menus patch
./release.sh axiom patch
./release.sh umami patch
./release.sh custom-panel patch
./release.sh home-nav patch
./release.sh import-wordpress patch
./release.sh health patch
./release.sh auth patch
./release.sh redirections patch
```

### Test a package locally

```bash
pnpm --filter @composius/payload-plugin-<name> build
cd packages/payload-plugin-<name> && pnpm pack
```
