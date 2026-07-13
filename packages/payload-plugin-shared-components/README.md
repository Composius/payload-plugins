# @vitrailweb/payload-plugin-shared-components

Shared building blocks used by the Vitrail Web [Payload CMS](https://payloadcms.com) plugins (articles, pages, ...). **Private**: it is never published — each plugin bundles (inlines) it into its own `dist/` at build time via tsup, so published plugins have no dependency on it. Not a plugin itself — it exports pieces the plugins assemble:

- **Editor features** (`contentEditorFeatures`, `*ButtonFeature`) — the default lexical features with blockquote/list toolbar items rendered as buttons plus a fixed toolbar. The server factories take the *consuming plugin's* client module path (e.g. `@vitrailweb/payload-plugin-articles/client`), because Payload's import map resolves client components from the host app: the path must belong to a package the app installs directly. Each plugin re-exports the client features from `@vitrailweb/payload-plugin-shared-components/client` under its own `/client` export.
- **SEO** (`seoField`, `defaultGenerate*`, `SEO_DESCRIPTION_MAX_LENGTH`) — the sidebar `meta` group built from `@payloadcms/plugin-seo` fields, and default generate functions (title from `title`, description from `content` rich text, image from `coverImage`, URL from a slug-to-URL function).
- **Access** (`anyone`, `authenticated`, `authenticatedOrPublished`).

## Development

From the monorepo root:

```bash
pnpm install
pnpm vitest run packages/payload-plugin-shared-components/test    # unit tests
```

There is no build step — consuming plugins compile it from source.
