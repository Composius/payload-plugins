export const en = {
  descriptions: {
    from: 'The path to match, starting with a slash — or a regular expression when the match type is Regex.',
    preserveQuery:
      'Forwards the query string of the incoming request, unless the destination already has one.',
    priority: 'Higher values are evaluated first. Rules with the same priority run oldest first.',
    to: 'An absolute URL (https://…) or a path starting with a slash. Regex rules can use $1, $2 and $& to reuse captured groups.',
  },
  errors: {
    duplicate: 'A redirection with this path and match type already exists.',
    invalidRegex: 'Invalid regular expression',
    malformedUrl: 'Enter a valid absolute URL.',
    mustBeAbsoluteOrRooted: 'Enter an absolute URL (https://…) or a path starting with a slash.',
    mustBeRelative: 'Enter a path starting with a slash, not a full URL.',
    mustStartWithSlash: 'Enter a path starting with a slash.',
    noQueryOrHash: 'Remove the query string and fragment — only the path is matched.',
    selfRedirect: 'The destination is the same as the path to match, which would loop.',
    unsupportedProtocol: 'Only http:// and https:// destinations are supported.',
  },
  fields: {
    enabled: 'Enabled',
    from: 'Path to match',
    matchType: 'Match type',
    preserveQuery: 'Keep the query string',
    priority: 'Priority',
    status: 'Status code',
    to: 'Destination',
  },
  matchTypes: {
    exact: 'Exact — the whole path',
    prefix: 'Prefix — the path and everything under it',
    regex: 'Regex — a regular expression',
  },
  redirections: {
    plural: 'Redirections',
    singular: 'Redirection',
  },
  statuses: {
    301: '301 — Moved permanently',
    302: '302 — Found (temporary)',
    307: '307 — Temporary redirect',
    308: '308 — Permanent redirect',
  },
}
