import type { CollectionSlug } from 'payload'

import { VWPayloadPluginHealth } from '@vitrailweb/payload-plugin-health'
import path from 'path'
import { fileURLToPath } from 'url'

import { buildDevConfig } from '../shared.js'
import { seed } from './seed.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildDevConfig({
  dirname,
  plugins: [
    VWPayloadPluginHealth({
      checks: {
        database: async (req) => {
          // The admin user collection always exists, whatever its slug.
          await req.payload.count({
            collection: req.payload.config.admin.user as CollectionSlug,
          })
        },
      },
    }),
  ],
  seed,
})
