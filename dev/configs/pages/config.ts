import { ComposiusPayloadPluginPages } from '@composius/payload-plugin-pages'
import path from 'path'
import { fileURLToPath } from 'url'

import { buildDevConfig } from '../shared.js'
import { seed } from './seed.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildDevConfig({
  dirname,
  plugins: [ComposiusPayloadPluginPages()],
  seed,
})
