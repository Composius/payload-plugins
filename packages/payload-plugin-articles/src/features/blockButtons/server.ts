import type { FeatureProviderServer } from '@payloadcms/richtext-lexical'
import {
  BlockquoteFeature,
  ChecklistFeature,
  OrderedListFeature,
  UnorderedListFeature,
} from '@payloadcms/richtext-lexical'

/**
 * Server counterparts of the features in `client.ts`: identical to the default
 * features, except they point to the wrapped client features that render their
 * toolbar items as buttons instead of inside the "text" dropdown.
 */
const withClientFeature = <UnSanitizedProps, ServerProps, ClientProps>(
  provider: FeatureProviderServer<UnSanitizedProps, ServerProps, ClientProps>,
  clientExport: string,
): FeatureProviderServer<UnSanitizedProps, ServerProps, ClientProps> => {
  const { feature } = provider
  const ClientFeature = `@vitrailweb/payload-plugin-articles/client#${clientExport}`

  return {
    ...provider,
    feature:
      typeof feature === 'function'
        ? async (args) => ({ ...(await feature(args)), ClientFeature })
        : { ...feature, ClientFeature },
  }
}

export const BlockquoteButtonFeature = () =>
  withClientFeature(BlockquoteFeature(), 'BlockquoteButtonFeatureClient')

export const ChecklistButtonFeature = () =>
  withClientFeature(ChecklistFeature(), 'ChecklistButtonFeatureClient')

export const OrderedListButtonFeature = () =>
  withClientFeature(OrderedListFeature(), 'OrderedListButtonFeatureClient')

export const UnorderedListButtonFeature = () =>
  withClientFeature(UnorderedListFeature(), 'UnorderedListButtonFeatureClient')
