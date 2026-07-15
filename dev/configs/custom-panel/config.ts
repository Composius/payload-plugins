import { VWPayloadPluginCustomPanel } from '@vitrailweb/payload-plugin-custom-panel'
import path from 'path'
import { fileURLToPath } from 'url'

import { buildDevConfig } from '../shared.js'
import { seed } from './seed.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildDevConfig({
  dirname,
  plugins: [
    VWPayloadPluginCustomPanel({
      title: 'Vitrail Web',
      rows: [
        {
          message: {
            en: 'Welcome! Manage media from the sidebar, or use the quick links.',
            fr: 'Bienvenue ! Gérez les médias depuis la barre latérale ou utilisez les liens rapides.',
          },
          links: [
            { icon: '🖼️', label: { en: 'Media', fr: 'Médias' }, url: '/admin/collections/media' },
          ],
        },
        {
          message: {
            en: 'Need help? The Payload documentation covers everything.',
            fr: 'Besoin d’aide ? La documentation Payload couvre tout.',
          },
          links: [
            {
              icon: '📚',
              label: { en: 'Payload docs', fr: 'Docs Payload' },
              newTab: true,
              url: 'https://payloadcms.com/docs',
            },
          ],
        },
      ],
    }),
  ],
  seed,
})
