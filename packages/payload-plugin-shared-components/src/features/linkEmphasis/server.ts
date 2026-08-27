import { createServerFeature } from '@payloadcms/richtext-lexical'

export type EditorLinkEmphasisFeatureProps = {
  /**
   * Import-map path of the module re-exporting `EditorLinkEmphasisFeatureClient`,
   * e.g. `@composius/payload-plugin-articles/client`. As with the other shared
   * features, it must be an export of the consuming plugin: Payload resolves
   * client components from the packages the host app installs directly.
   */
  clientModulePath: string
}

/**
 * Gives the editor's links more contrast than Payload's green-on-dotted-border:
 * blue, continuously underlined. It is CSS over the admin panel alone — nothing
 * is written to a node, so a front end renders its links exactly as before.
 */
export const EditorLinkEmphasisFeature = createServerFeature<EditorLinkEmphasisFeatureProps>({
  feature: ({ props }) => ({
    ClientFeature: `${props.clientModulePath}#EditorLinkEmphasisFeatureClient`,
  }),
  key: 'editorLinkEmphasis',
})
