import { ComposiusPayloadPluginMedia } from '@composius/payload-plugin-media'
import path from 'path'
import { fileURLToPath } from 'url'

import { buildDevConfig } from '../shared.js'
import { seed } from './seed.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildDevConfig({
  defaultMediaCollection: false,
  dirname,
  plugins: [
    ComposiusPayloadPluginMedia({
      prefix: { folder: 'uploads' },
      randomSuffix: false,
      staticDir: path.resolve(dirname, 'media'),
    }),
  ],
  seed,
})
