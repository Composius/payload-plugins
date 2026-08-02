import { ComposiusPayloadPluginHealth } from '@composius/payload-plugin-health'
import path from 'path'
import { fileURLToPath } from 'url'

import { buildDevConfig } from '../shared.js'
import { seed } from './seed.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildDevConfig({
  dirname,
  // The built-in `database` check is added by default.
  plugins: [ComposiusPayloadPluginHealth()],
  seed,
})
