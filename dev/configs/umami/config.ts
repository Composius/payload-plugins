import { VWPayloadPluginUmami } from '@vitrailweb/payload-plugin-umami'
import path from 'path'
import { fileURLToPath } from 'url'

import { buildDevConfig } from '../shared.js'
import { seed } from './seed.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildDevConfig({
  dirname,
  plugins: [
    VWPayloadPluginUmami({
      websiteId: process.env.UMAMI_WEBSITE_ID || '',
      // Umami Cloud: pass an API key. Self-hosted: pass baseUrl + username/password.
      apiKey: process.env.UMAMI_API_KEY,
      baseUrl: process.env.UMAMI_BASE_URL,
      username: process.env.UMAMI_USERNAME,
      password: process.env.UMAMI_PASSWORD,
    }),
  ],
  seed,
})
