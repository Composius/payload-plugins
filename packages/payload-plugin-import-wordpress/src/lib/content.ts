import type { SanitizedServerEditorConfig } from '@payloadcms/richtext-lexical'

import { convertHTMLToLexical } from '@payloadcms/richtext-lexical'
import { JSDOM } from 'jsdom'

import type { LinkMapping } from '../types.js'
import type { ImageImportResult } from './media.js'
import type { LexNode } from './lexical.js'

import { imageToken, replaceImageTokens, rewriteLinkNodes } from './lexical.js'

export type BuildContentArgs = {
  articleUrl: (slug?: null | string) => string
  editorConfig: SanitizedServerEditorConfig
  html: string
  /** Uploads (or plans) a content image and returns the resulting media id. */
  importContentImage: (src: string) => Promise<ImageImportResult>
  mediaSlug: string
  /** Resolves an internal WordPress link to an imported article slug, or null. */
  resolveInternal: (url: string, slug: null | string) => null | string
  siteHost: string
}

export type BuildContentResult = {
  content: { root: LexNode }
  images: Array<{ result: ImageImportResult; src: string }>
  links: LinkMapping[]
}

/**
 * Converts a WordPress post's rendered HTML into a Lexical editor state:
 * uploads in-content images (dedup-aware) and turns them into upload nodes,
 * and rewrites internal links that point at imported posts. Images are first
 * swapped for block-level text tokens so they survive HTML→Lexical conversion
 * at their original position, then replaced with upload nodes afterwards.
 */
export const buildContent = async (args: BuildContentArgs): Promise<BuildContentResult> => {
  const dom = new JSDOM(`<!DOCTYPE html><body>${args.html}</body>`)
  const { document } = dom.window
  const images: Array<{ result: ImageImportResult; src: string }> = []
  const tokenToMedia = new Map<number, null | string>()

  const imgs = Array.from(document.querySelectorAll('img'))
  let index = 0
  for (const img of imgs) {
    const src = img.getAttribute('src') || ''
    if (!src) {
      img.remove()
      continue
    }

    const result = await args.importContentImage(src)
    images.push({ result, src })

    const token = index
    tokenToMedia.set(token, result.mediaId)
    index += 1

    // Choose the block to replace: prefer an enclosing <figure>, else an
    // <a> that only wraps this image, else the image itself.
    let target: Element = img
    const anchor = img.parentElement
    if (anchor && anchor.tagName === 'A' && anchor.childNodes.length === 1) {
      target = anchor
    }
    const figure = target.closest('figure')
    if (figure) {
      target = figure
    }

    const placeholder = document.createElement('p')
    placeholder.textContent = imageToken(token)
    target.replaceWith(placeholder)
  }

  const modifiedHtml = document.body.innerHTML

  const state = convertHTMLToLexical({
    editorConfig: args.editorConfig,
    html: modifiedHtml,
    JSDOM: JSDOM as unknown as new (html: string) => { window: { document: Document } },
  }) as unknown as { root: LexNode }

  replaceImageTokens(state.root, (i) => tokenToMedia.get(i) ?? null, args.mediaSlug)

  const links = rewriteLinkNodes(state.root, {
    articleUrl: args.articleUrl,
    resolveInternal: args.resolveInternal,
    siteHost: args.siteHost,
  })

  return { content: state, images, links }
}
