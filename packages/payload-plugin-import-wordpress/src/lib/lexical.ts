import type { LinkMapping } from '../types.js'

import { coerceId } from './id.js'
import { isInternalUrl, permalinkToSlug } from './url.js'

/** Loosely-typed serialized Lexical node (we only touch a few well-known shapes). */
export type LexNode = {
  children?: LexNode[]
  fields?: Record<string, unknown>
  tag?: string
  text?: string
  type: string
  [key: string]: unknown
}

export type LexRoot = { root: LexNode }

/**
 * Block-level placeholder inserted in place of each `<img>` before HTML→Lexical
 * conversion. It is unlikely to appear in real content and survives conversion
 * as a paragraph containing a single text node, which `replaceImageTokens`
 * then swaps for an upload node.
 */
export const imageToken = (index: number): string => `⁣WPIMG:${index}⁣`

const IMAGE_TOKEN_RE = /^⁣WPIMG:(\d+)⁣$/

/** Extracts `src` attributes of every `<img>` in an HTML string (order-preserving). */
export const extractImageSrcs = (html: string): string[] => {
  const srcs: string[] = []
  const re = /<img\b[^>]*?\bsrc\s*=\s*(["'])(.*?)\1/gi
  let match: null | RegExpExecArray
  while ((match = re.exec(html)) !== null) {
    srcs.push(match[2])
  }
  return srcs
}

/** Builds a serialized Lexical upload (decorator block) node for a media doc. */
export const buildUploadNode = (value: number | string, relationTo: string): LexNode => ({
  type: 'upload',
  fields: null as unknown as Record<string, unknown>,
  format: '',
  relationTo,
  value: coerceId(value),
  version: 3,
})

/** Depth-first walk over a serialized tree, invoking `visit` on every node. */
export const walk = (node: LexNode, visit: (node: LexNode) => void): void => {
  visit(node)
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      walk(child, visit)
    }
  }
}

/** Returns the sole text of a node if it is a paragraph wrapping one text node. */
const soleTextTokenIndex = (node: LexNode): null | number => {
  if (node.type !== 'paragraph' || !Array.isArray(node.children) || node.children.length !== 1) {
    return null
  }
  const child = node.children[0]
  if (child.type !== 'text' || typeof child.text !== 'string') {
    return null
  }
  const m = IMAGE_TOKEN_RE.exec(child.text.trim())
  return m ? Number(m[1]) : null
}

/**
 * Replaces token paragraphs (created by `imageToken`) with upload nodes.
 * `resolve(index)` returns the uploaded media id for that image, or `null` to
 * drop the placeholder. Mutates and returns the same root.
 */
export const replaceImageTokens = (
  root: LexNode,
  resolve: (index: number) => null | number | string,
  mediaSlug: string,
): LexNode => {
  const replaceIn = (parent: LexNode): void => {
    if (!Array.isArray(parent.children)) {
      return
    }
    const next: LexNode[] = []
    for (const child of parent.children) {
      const index = soleTextTokenIndex(child)
      if (index !== null) {
        const mediaId = resolve(index)
        if (mediaId !== null && mediaId !== undefined) {
          next.push(buildUploadNode(mediaId, mediaSlug))
        }
        continue
      }
      replaceIn(child)
      next.push(child)
    }
    parent.children = next
  }
  replaceIn(root)
  return root
}

/**
 * Finds, removes and returns the value of the first upload node in document
 * order, or `null` when the tree has none. Used to promote a leading content
 * image to the cover field when the post has no featured image.
 */
export const takeFirstUploadNode = (root: LexNode): null | number | string => {
  const search = (parent: LexNode): null | number | string => {
    if (!Array.isArray(parent.children)) {
      return null
    }
    for (let i = 0; i < parent.children.length; i += 1) {
      const child = parent.children[i]
      if (child.type === 'upload') {
        parent.children.splice(i, 1)
        return (child as { value?: number | string }).value ?? null
      }
      const nested = search(child)
      if (nested !== null) {
        return nested
      }
    }
    return null
  }
  return search(root)
}

const isEmptyParagraph = (node: LexNode): boolean =>
  node.type === 'paragraph' &&
  (!Array.isArray(node.children) ||
    node.children.every((child) => child.type === 'text' && !(child.text ?? '').trim()))

/**
 * Drops a leading duplicate of the cover image: when the first non-empty block
 * is an upload of `value`, it is removed so the hero doesn't render twice
 * (once as the cover, once at the top of the content).
 */
export const removeLeadingUploadNode = (root: LexNode, value: number | string): boolean => {
  const children = root.children
  if (!Array.isArray(children)) {
    return false
  }
  for (let i = 0; i < children.length; i += 1) {
    const child = children[i]
    if (isEmptyParagraph(child)) {
      continue
    }
    if (
      child.type === 'upload' &&
      String((child as { value?: unknown }).value) === String(value)
    ) {
      children.splice(i, 1)
      return true
    }
    return false
  }
  return false
}

export type LinkRewriteOptions = {
  articleUrl: (slug?: null | string) => string
  siteHost: string
  /** Resolves a WordPress permalink/slug to an imported article slug, or null. */
  resolveInternal: (url: string, slug: null | string) => null | string
}

/**
 * Rewrites internal `<a>` links whose target was imported and records every
 * internal link for the report. External links and unresolved internal links
 * are left untouched. Returns the collected link mappings.
 */
export const rewriteLinkNodes = (root: LexNode, options: LinkRewriteOptions): LinkMapping[] => {
  const { articleUrl, resolveInternal, siteHost } = options
  const links: LinkMapping[] = []

  walk(root, (node) => {
    if (node.type !== 'link' || !node.fields) {
      return
    }
    const url = typeof node.fields.url === 'string' ? node.fields.url : ''
    if (!url || !isInternalUrl(url, siteHost)) {
      return
    }
    const slug = permalinkToSlug(url)
    const targetSlug = resolveInternal(url, slug)
    if (targetSlug) {
      const to = articleUrl(targetSlug)
      node.fields.url = to
      node.fields.linkType = 'custom'
      links.push({ action: 'rewritten', from: url, to })
    } else {
      links.push({ action: 'unresolved', from: url })
    }
  })

  return links
}
