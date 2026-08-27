import type { FeatureProviderServer, LexicalEditorProps } from '@payloadcms/richtext-lexical'
import {
  BlockquoteFeature,
  BlocksFeature,
  ChecklistFeature,
  FixedToolbarFeature,
  OrderedListFeature,
  UnorderedListFeature,
} from '@payloadcms/richtext-lexical'
import type { EditorFontSize } from '../fontSize/sizes.js'
import { EditorFontSizeFeature } from '../fontSize/server.js'
import { EditorLinkEmphasisFeature } from '../linkEmphasis/server.js'
import { videoEmbedBlock } from '../videoEmbed/block.js'
import { VideoEmbedTitlesFeature } from '../videoEmbed/feature.js'

/**
 * Server counterparts of the features in `client.ts`: identical to the default
 * features, except they point to the wrapped client features that render their
 * toolbar items as buttons instead of inside the "text" dropdown.
 *
 * `clientModulePath` is the import-map path of the module re-exporting the
 * client features (e.g. `@composius/payload-plugin-articles/client`). It must
 * be an export of the consuming plugin itself — not of this shared package —
 * so the host app can resolve it as a direct dependency.
 */
const withClientFeature = <UnSanitizedProps, ServerProps, ClientProps>(
  provider: FeatureProviderServer<UnSanitizedProps, ServerProps, ClientProps>,
  clientModulePath: string,
  clientExport: string,
): FeatureProviderServer<UnSanitizedProps, ServerProps, ClientProps> => {
  const { feature } = provider
  const ClientFeature = `${clientModulePath}#${clientExport}`

  return {
    ...provider,
    feature:
      typeof feature === 'function'
        ? async (args) => ({ ...(await feature(args)), ClientFeature })
        : { ...feature, ClientFeature },
  }
}

export const BlockquoteButtonFeature = (clientModulePath: string) =>
  withClientFeature(BlockquoteFeature(), clientModulePath, 'BlockquoteButtonFeatureClient')

export const ChecklistButtonFeature = (clientModulePath: string) =>
  withClientFeature(ChecklistFeature(), clientModulePath, 'ChecklistButtonFeatureClient')

export const OrderedListButtonFeature = (clientModulePath: string) =>
  withClientFeature(OrderedListFeature(), clientModulePath, 'OrderedListButtonFeatureClient')

export const UnorderedListButtonFeature = (clientModulePath: string) =>
  withClientFeature(UnorderedListFeature(), clientModulePath, 'UnorderedListButtonFeatureClient')

export type ContentEditorOptions = {
  /**
   * Draws the editor's links blue and continuously underlined, rather than the
   * green under a dotted border Payload gives them. CSS over the admin panel
   * alone, scoped to this editor.
   * @default false
   */
  emphasizeLinks?: boolean
  /**
   * The font size control on the toolbar, which scales the admin editor with
   * CSS alone. A size sets what the editor opens at until someone picks another;
   * `false` leaves the control out and the editor at Payload's own size.
   * @default 'normal'
   */
  fontSize?: EditorFontSize | false
}

/**
 * Default-features callback for `lexicalEditor()`: swaps the default
 * blockquote/list features for the button wrappers above, adds a fixed toolbar,
 * the font size control, optionally the link emphasis, and the video embed
 * block, whose titles the accompanying feature fills in on save.
 */
export const contentEditorFeatures =
  (
    clientModulePath: string,
    { emphasizeLinks, fontSize }: ContentEditorOptions = {},
  ): NonNullable<LexicalEditorProps['features']> =>
  ({ defaultFeatures }) => [
    ...defaultFeatures.filter(
      ({ key }) => !['blockquote', 'checklist', 'orderedList', 'unorderedList'].includes(key),
    ),
    UnorderedListButtonFeature(clientModulePath),
    OrderedListButtonFeature(clientModulePath),
    ChecklistButtonFeature(clientModulePath),
    BlockquoteButtonFeature(clientModulePath),
    FixedToolbarFeature(),
    ...(fontSize === false
      ? []
      : [EditorFontSizeFeature({ clientModulePath, defaultSize: fontSize })]),
    ...(emphasizeLinks ? [EditorLinkEmphasisFeature({ clientModulePath })] : []),
    BlocksFeature({ blocks: [videoEmbedBlock(clientModulePath)] }),
    VideoEmbedTitlesFeature(),
  ]
