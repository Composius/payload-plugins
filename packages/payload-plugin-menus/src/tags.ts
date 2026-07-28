import { collectionTag, fieldTag, idTag } from '@composius/payload-plugin-shared-components/tags'

/**
 * The cache tags the collection hooks invalidate. Claim the matching one with
 * `cacheTag` inside a `'use cache'` function and a save in the admin panel
 * reaches the front end.
 *
 * Re-exported from `@composius/payload-plugin-menus/tags`, which pulls in
 * neither `payload` nor `next` and is the import to reach for in layout code.
 */

/** Every menu. The tag for a layout that renders whichever menus it finds. */
export const MENUS_TAG = collectionTag('menus')

/**
 * One menu, by name — how a layout usually looks a menu up, having no id to
 * hand. Menu names are not unique, so this tag covers every menu sharing one.
 */
export const menuTag = (name: string): string => fieldTag('menus', 'name', name)

/** One menu, by id. */
export const menuIdTag = (id: number | string): string => idTag('menus', id)
