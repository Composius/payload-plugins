import { createServerFeature } from '@payloadcms/richtext-lexical'

import { fillVideoEmbedTitles } from './titleHook.js'

/**
 * Carries the title lookup as part of the editor rather than as a hook each
 * content field has to remember to declare. Feature hooks are concatenated
 * across features, so this composes with whatever else the editor is built
 * from, and reaches every rich text the features are used for — including the
 * one nested inside another block.
 *
 * It has to be a feature-level hook: field hooks declared on a lexical block's
 * own fields are never run.
 */
export const VideoEmbedTitlesFeature = createServerFeature({
  feature: {
    hooks: {
      beforeChange: [fillVideoEmbedTitles],
    },
  },
  key: 'videoEmbedTitles',
})
