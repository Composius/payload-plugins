import { VWPayloadPluginAxiom } from '@vitrailweb/payload-plugin-axiom'
import path from 'path'
import { fileURLToPath } from 'url'

import { buildDevConfig } from '../shared.js'
import { seed } from './seed.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildDevConfig({
  dirname,
  plugins: [
    VWPayloadPluginAxiom({
      dataset: process.env.AXIOM_DATASET || '',
      token: process.env.AXIOM_TOKEN || '',
      // Only needed for personal tokens / regional or self-hosted deployments.
      edge: process.env.AXIOM_EDGE,
      edgeUrl: process.env.AXIOM_EDGE_URL,
      orgId: process.env.AXIOM_ORG_ID,
      url: process.env.AXIOM_URL,
    }),
  ],
  seed,
})
