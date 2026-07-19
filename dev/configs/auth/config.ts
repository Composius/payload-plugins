import { ComposiusPayloadPluginAuth } from '@composius/payload-plugin-auth'
import path from 'path'
import { fileURLToPath } from 'url'

import { buildDevConfig } from '../shared.js'
import { seed } from './seed.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildDevConfig({
  dirname,
  plugins: [ComposiusPayloadPluginAuth()],
  seed,
})
