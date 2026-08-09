import type { Block, TextFieldSingleValidation } from 'payload'
import { label, t } from '../../translations/index.js'
import { parseVideoEmbedUrl } from './providers.js'

export const VIDEO_EMBED_BLOCK_SLUG = 'videoEmbed'

const validateUrl: TextFieldSingleValidation = (value, { req }) => {
  if (typeof value !== 'string' || value.length === 0) {
    // `required` already reports an empty value.
    return true
  }

  return parseVideoEmbedUrl(value)
    ? true
    : t(req?.i18n?.language, (m) => m.videoEmbed.errors.unsupportedUrl)
}

/**
 * Lexical block embedding a video from its public link. The link is the only
 * thing an editor fills in, and the only thing the block really holds:
 * `parseVideoEmbedUrl` turns it into a player URL at render time, so a document
 * never carries a stale iframe URL of a provider that has moved on.
 *
 * `title` is read-only, filled from the provider on save by
 * `fillVideoEmbedTitles` — a label for the editor scanning the document, not
 * something a front end has to trust. Its field component looks the same title
 * up as the link is typed, so the editor sees it without waiting for a save.
 * `titleUnavailable` records a lookup that came back empty, which is what the
 * component reports under the field.
 *
 * `clientModulePath` is the import-map path of the consuming plugin's client
 * module (e.g. `@composius/payload-plugin-articles/client`), for the same
 * reason the editor features take one: Payload resolves client components from
 * a package the host app installs directly.
 *
 * A factory rather than a shared object — Payload marks a block sanitized in
 * place, so two configs built in one process (the dev suites, a test file)
 * would otherwise pass the same mutated definition around.
 */
export const videoEmbedBlock = (clientModulePath: string): Block => ({
  slug: VIDEO_EMBED_BLOCK_SLUG,
  labels: {
    singular: label((m) => m.videoEmbed.singular),
    plural: label((m) => m.videoEmbed.plural),
  },
  fields: [
    {
      name: 'url',
      type: 'text',
      label: label((m) => m.videoEmbed.fields.url),
      required: true,
      admin: {
        description: label((m) => m.videoEmbed.fields.urlDescription),
      },
      validate: validateUrl,
    },
    {
      name: 'title',
      type: 'text',
      label: label((m) => m.videoEmbed.fields.title),
      admin: {
        components: {
          Field: `${clientModulePath}#VideoEmbedTitleField`,
        },
        readOnly: true,
      },
    },
    {
      name: 'titleUnavailable',
      type: 'checkbox',
      admin: {
        hidden: true,
      },
    },
  ],
})
