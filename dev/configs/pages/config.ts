import type { Block } from 'payload'

import { ComposiusPayloadPluginPages, contentBlock } from '@composius/payload-plugin-pages'
import path from 'path'
import { fileURLToPath } from 'url'

import { buildDevConfig } from '../shared.js'
import { seed } from './seed.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// Registered on the config, so the pages layout can name it by slug alone.
const hero: Block = {
  slug: 'hero',
  fields: [{ name: 'heading', type: 'text' }],
}

const callToAction: Block = {
  slug: 'callToAction',
  fields: [
    { name: 'label', type: 'text' },
    { name: 'href', type: 'text' },
  ],
}

export default buildDevConfig({
  blocks: [hero, contentBlock()],
  dirname,
  plugins: [
    ComposiusPayloadPluginPages({
      blockReferences: ['content', 'hero'],
      blocks: [callToAction],
      // content: true,
    }),
  ],
  seed,
})
