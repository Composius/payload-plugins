'use client'

import type {
  ClientFeature,
  FeatureProviderProviderClient,
  ToolbarGroup,
} from '@payloadcms/richtext-lexical'
import {
  BlockquoteFeatureClient,
  ChecklistFeatureClient,
  OrderedListFeatureClient,
  UnorderedListFeatureClient,
} from '@payloadcms/richtext-lexical/client'

/**
 * The default blockquote and list features register their toolbar items inside
 * the "text" dropdown, next to paragraph and headings. These wrappers re-home
 * those items into a shared `buttons` group so they render as standalone
 * toolbar buttons, leaving only paragraph and headings in the dropdown.
 */
const asButtonsGroup = (groups: ToolbarGroup[]): ToolbarGroup[] =>
  groups.map((group) =>
    group.key === 'text'
      ? {
          type: 'buttons',
          items: group.items,
          key: 'blockButtons',
          // Between the "text" dropdown (25) and the format buttons (40).
          order: 30,
        }
      : group,
  )

const remapToolbar = (
  toolbar: { groups: ToolbarGroup[] } | undefined,
): { groups: ToolbarGroup[] } | undefined =>
  toolbar ? { ...toolbar, groups: asButtonsGroup(toolbar.groups) } : toolbar

const withToolbarButtons = <UnSanitizedProps, Props>(
  clientFeature: FeatureProviderProviderClient<UnSanitizedProps, Props>,
): FeatureProviderProviderClient<UnSanitizedProps, Props> => {
  return (clientFeatureProps) => {
    const provider = clientFeature(clientFeatureProps)

    return {
      ...provider,
      feature: (args) => {
        const feature: ClientFeature<Props> =
          typeof provider.feature === 'function' ? provider.feature(args) : provider.feature

        return {
          ...feature,
          toolbarFixed: remapToolbar(feature.toolbarFixed),
          toolbarInline: remapToolbar(feature.toolbarInline),
        }
      },
    }
  }
}

export const BlockquoteButtonFeatureClient = withToolbarButtons(BlockquoteFeatureClient)
export const ChecklistButtonFeatureClient = withToolbarButtons(ChecklistFeatureClient)
export const OrderedListButtonFeatureClient = withToolbarButtons(OrderedListFeatureClient)
export const UnorderedListButtonFeatureClient = withToolbarButtons(UnorderedListFeatureClient)
