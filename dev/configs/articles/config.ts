import { ComposiusPayloadPluginArticles } from '@composius/payload-plugin-articles'
import path from 'path'
import { fileURLToPath } from 'url'

import { buildDevConfig } from '../shared.js'
import { seed } from './seed.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildDevConfig({
  dirname,
  plugins: [ComposiusPayloadPluginArticles()],
  seed,
})
