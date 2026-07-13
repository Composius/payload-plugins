import { VWPayloadPluginMenus } from '@vitrailweb/payload-plugin-menus'
import path from 'path'
import { fileURLToPath } from 'url'

import { buildDevConfig } from '../shared.js'
import { seed } from './seed.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildDevConfig({
  dirname,
  plugins: [
    VWPayloadPluginMenus({
      collections: ['users'],
    }),
  ],
  seed,
})
