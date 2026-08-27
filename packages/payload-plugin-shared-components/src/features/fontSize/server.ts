import { createServerFeature } from '@payloadcms/richtext-lexical'

import type { EditorFontSize } from './sizes.js'

import { DEFAULT_EDITOR_FONT_SIZE } from './sizes.js'

export type EditorFontSizeFeatureProps = {
  /**
   * Import-map path of the module re-exporting `EditorFontSizeFeatureClient`,
   * e.g. `@composius/payload-plugin-articles/client`. As with the other shared
   * features, it must be an export of the consuming plugin: Payload resolves
   * client components from the packages the host app installs directly.
   */
  clientModulePath: string
  /** The size an editor opens at, before anyone has picked one. */
  defaultSize?: EditorFontSize
}

/**
 * Puts a font size control on the editor toolbar. It scales the admin editor
 * with CSS alone — nothing is written to the document, so a front end renders
 * the content exactly as it did before.
 */
export const EditorFontSizeFeature = createServerFeature<
  EditorFontSizeFeatureProps,
  EditorFontSizeFeatureProps,
  { defaultSize: EditorFontSize }
>({
  feature: ({ props }) => ({
    ClientFeature: `${props.clientModulePath}#EditorFontSizeFeatureClient`,
    clientFeatureProps: { defaultSize: props.defaultSize ?? DEFAULT_EDITOR_FONT_SIZE },
  }),
  key: 'editorFontSize',
})
