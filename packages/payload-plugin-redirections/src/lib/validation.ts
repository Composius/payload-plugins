import type { RedirectionMatchType } from '../types.js'

import { isAbsoluteUrl, normalizePath } from './paths.js'

/**
 * Pure validators, shared by the collection's field-level `validate` functions
 * and by the rules endpoint (which drops anything that no longer holds). Like
 * the rest of `lib/`, this module imports neither `payload` nor `next`.
 */

export type SourceErrorCode =
  | 'invalidRegex'
  | 'mustBeRelative'
  | 'mustStartWithSlash'
  | 'noQueryOrHash'

export type DestinationErrorCode = 'malformedUrl' | 'mustBeAbsoluteOrRooted' | 'unsupportedProtocol'

export type ValidationIssue<Code extends string> = {
  code: Code
  /** Engine-supplied context, currently only the regex compilation error. */
  detail?: string
}

/** Validates a rule's `from` for the given match type. */
export const validateSource = (
  value: string,
  matchType: RedirectionMatchType,
): undefined | ValidationIssue<SourceErrorCode> => {
  if (matchType === 'regex') {
    try {
      new RegExp(value)
      return undefined
    } catch (error) {
      return {
        code: 'invalidRegex',
        detail: error instanceof Error ? error.message : String(error),
      }
    }
  }

  if (isAbsoluteUrl(value)) {
    return { code: 'mustBeRelative' }
  }

  if (!value.startsWith('/')) {
    return { code: 'mustStartWithSlash' }
  }

  // Only the pathname ever takes part in matching.
  if (/[?#]/.test(value)) {
    return { code: 'noQueryOrHash' }
  }

  return undefined
}

/** Validates a rule's `to`: an absolute http(s) URL, or a root-relative path. */
export const validateDestination = (
  value: string,
): undefined | ValidationIssue<DestinationErrorCode> => {
  if (isAbsoluteUrl(value)) {
    // Protocol-relative URLs inherit the request's scheme, so they are fine.
    if (value.startsWith('//')) {
      return undefined
    }

    try {
      return /^https?:$/.test(new URL(value).protocol)
        ? undefined
        : { code: 'unsupportedProtocol' }
    } catch {
      return { code: 'malformedUrl' }
    }
  }

  return value.startsWith('/') ? undefined : { code: 'mustBeAbsoluteOrRooted' }
}

/**
 * True when an exact rule points at its own source. The resolver skips such a
 * rule at request time, but rejecting it on save tells the editor why.
 */
export const isSelfRedirect = (from: string, to: string, matchType: RedirectionMatchType): boolean =>
  matchType === 'exact' && !isAbsoluteUrl(to) && normalizePath(from) === normalizePath(to)
