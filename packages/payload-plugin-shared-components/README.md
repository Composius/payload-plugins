# @composius/payload-plugin-shared-components

Shared building blocks used by the Composius [Payload CMS](https://payloadcms.com) plugins (articles, pages, ...). **Private**: it is never published — each plugin bundles (inlines) it into its own `dist/` at build time via tsup, so published plugins have no dependency on it. Not a plugin itself — it exports pieces the plugins assemble:

- **Editor features** (`contentEditorFeatures`, `*ButtonFeature`) — the default lexical features with blockquote/list toolbar items rendered as buttons plus a fixed toolbar. The server factories take the *consuming plugin's* client module path (e.g. `@composius/payload-plugin-articles/client`), because Payload's import map resolves client components from the host app: the path must belong to a package the app installs directly. Each plugin re-exports the client features from `@composius/payload-plugin-shared-components/client` under its own `/client` export.
- **Editor font size** (`EditorFontSizeFeature`, `EditorFontSizeFeatureClient`, `EDITOR_FONT_SIZES`) — the toolbar dropdown `contentEditorFeatures` adds, scaling the admin editor between `small`, `normal`, `large` and `huge`. It is **CSS only**: the client feature injects one stylesheet restating Payload's own editor font sizes as `calc(<payload's px> * var(--composius-editor-font-scale, 1))` and writes the scale on `document.documentElement`, so nothing is written to a node and a front end renders the document untouched. The rules are deliberately unlayered — Payload ships its admin CSS inside `@layer payload-default`, and unlayered rules win over layered ones whatever their specificity. The scale sits on the root rather than per editor, so the setting is one preference (remembered in `localStorage`) rather than one per field, and nested editors inherit it. `normal` maps to a scale of 1, which is exactly where the admin panel was before the feature existed.
- **Link emphasis** (`EditorLinkEmphasisFeature`, `EditorLinkEmphasisFeatureClient`) — the opt-in `contentEditorFeatures({ emphasizeLinks })` styling that draws editor links blue and continuously underlined, where Payload draws them in `--theme-success-750` under a dotted border. CSS only, and unlike the font size it is scoped rather than global: the client plugin puts `composius-editor-links--emphasized` on the editor's root element (through `registerRootListener`, so it follows Lexical swapping the root) and the stylesheet keys off that class, which is what lets a host emphasise the articles editor and leave the pages one alone. The blue is defined in the injected sheet — Payload's palette has elevation/success/error/warning ramps and no blue — and switches on `html[data-theme]`, the way Payload's own admin CSS does.
- **Video embeds** (`videoEmbedBlock`, `VIDEO_EMBED_BLOCK_SLUG`, `parseVideoEmbedUrl`) — the lexical block `contentEditorFeatures` adds, holding the link of a YouTube, Vimeo or Gan Jing World video. `parseVideoEmbedUrl` is both halves of it: the field validator, and what a front end calls to turn the stored link into `{ embedUrl, id, provider }` at render time. Adding a block to the editor puts `@payloadcms/richtext-lexical/client#BlocksFeatureClient` and the block's own components in the import map, so the dev suites (and host apps) need `payload generate:importmap`.
- **Video titles** (`VideoEmbedTitlesFeature`, `fillVideoEmbedTitles`, `fetchVideoTitle`) — fills the block's read-only `title` from the provider as the document saves (oEmbed for YouTube and Vimeo, `og:title` for Gan Jing World, no keys). It ships as a lexical *feature* hook rather than a field hook, because **field hooks declared on a lexical block's own fields are never run** — the blocks feature registers no hook traversal for them. Feature hooks are concatenated across features (node hooks, by contrast, are `set()` per node type and would clobber another feature's), so it composes and reaches every rich text built from these features, nested ones included. The lookup is skipped for any link the previous save already resolved — or already failed to — which keeps autosave off the providers. `VideoEmbedTitleField` (the block's `title` component) runs the same lookup in the browser as the link is typed, because autosave stores what the hook resolves but never feeds it back into the open form; all three providers allow cross-origin reads, so no endpoint sits in between, and the save still refetches rather than trusting what the client sent.
- **SEO** (`seoField`, `defaultGenerate*`, `withSiteName`, `SEO_DESCRIPTION_MAX_LENGTH`) — the sidebar `meta` group built from `@payloadcms/plugin-seo` fields, and default generate functions (title from `title`, description from `content` rich text, image from `coverImage`, URL from a slug-to-URL function). `withSiteName` wraps any title generator to end its output with the site name (`Title | Site name`, separator overridable); given no site name it hands the generator back untouched, so the plugins can apply it unconditionally.
- **Access** (`anyone`, `authenticated`, `authenticatedOrPublished`).

## Requirements

The following dependencies are required to be installed in your project before using this plugin:

- `@payloadcms/plugin-seo` (`^3.84.1`)
- `@payloadcms/richtext-lexical` (`^3.84.1`)
- `payload` (`^3.84.1`)

```bash
pnpm add @payloadcms/plugin-seo @payloadcms/richtext-lexical payload
```

## Development

From the monorepo root:

```bash
pnpm install
pnpm vitest run packages/payload-plugin-shared-components/test    # unit tests
```

There is no build step — consuming plugins compile it from source.
