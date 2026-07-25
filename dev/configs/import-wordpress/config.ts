import { ComposiusPayloadPluginArticles } from '@composius/payload-plugin-articles'
import { ComposiusPayloadPluginImportWordpress } from '@composius/payload-plugin-import-wordpress'
import { ComposiusPayloadPluginMedia } from '@composius/payload-plugin-media'
import path from 'path'
import { fileURLToPath } from 'url'

import { buildDevConfig } from '../shared.js'
import { seed } from './seed.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildDevConfig({
  // The media plugin provides the `media` collection.
  defaultMediaCollection: false,
  dirname,
  plugins: [
    // Keep uploads inside the (gitignored) suite dir instead of the repo root.
    ComposiusPayloadPluginMedia({ staticDir: path.resolve(dirname, 'media') }),
    ComposiusPayloadPluginArticles({ authors: true }),
    ComposiusPayloadPluginImportWordpress({
      // A real (dotted, port-less) domain so rewritten internal links pass
      // Lexical's URL validation instead of being percent-encoded.
      articleUrl: (slug) => `/articles/${slug ?? ''}`,
      // Auto-process queued imports during interactive dev, but not under test
      // (int tests run the queue explicitly and must not leave a timer running).
      autoRun: process.env.NODE_ENV === 'test' ? false : true,
    }),
  ],
  seed,
})
