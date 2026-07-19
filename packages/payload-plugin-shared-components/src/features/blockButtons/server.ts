import type { FeatureProviderServer, LexicalEditorProps } from '@payloadcms/richtext-lexical'
import {
  BlockquoteFeature,
  ChecklistFeature,
  FixedToolbarFeature,
  OrderedListFeature,
  UnorderedListFeature,
} from '@payloadcms/richtext-lexical'

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

/**
 * Default-features callback for `lexicalEditor()`: swaps the default
 * blockquote/list features for the button wrappers above and adds a fixed
 * toolbar.
 */
export const contentEditorFeatures =
  (clientModulePath: string): NonNullable<LexicalEditorProps['features']> =>
  ({ defaultFeatures }) => [
    ...defaultFeatures.filter(
      ({ key }) => !['blockquote', 'checklist', 'orderedList', 'unorderedList'].includes(key),
    ),
    UnorderedListButtonFeature(clientModulePath),
    OrderedListButtonFeature(clientModulePath),
    ChecklistButtonFeature(clientModulePath),
    BlockquoteButtonFeature(clientModulePath),
    FixedToolbarFeature(),
  ]
