import { ComposiusPayloadPluginArticles } from '@composius/payload-plugin-articles'
import path from 'path'
import { fileURLToPath } from 'url'

import { buildDevConfig } from '../shared.js'
import { seed } from './seed.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildDevConfig({
  dirname,
  plugins: [
    ComposiusPayloadPluginArticles({
      authors: true,
      // Off by default: the suite turns it on so the feature is exercised, and
      // the pages suite leaves it alone so the default is exercised too.
      emphasizeEditorLinks: true,
      seo: {
        siteName: 'Composius Payload Plugin Articles',
      },
    }),
  ],
  seed,
})
