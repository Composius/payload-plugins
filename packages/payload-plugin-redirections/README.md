# @composius/payload-plugin-redirections

A [Payload CMS](https://payloadcms.com) plugin that adds a `redirections` collection of
URL-to-URL rules — matched exactly, by prefix, or by regular expression — plus a
Next.js proxy helper that applies them at request time.

Destinations are always plain URLs, never relationships to other collections. If you
want document references instead, use
[`@payloadcms/plugin-redirects`](https://payloadcms.com/docs/plugins/redirects); its
slug is `redirects`, deliberately distinct from this plugin's `redirections`, so the
two can live in the same app.

## Fields

| Field           | Type       | Notes                                                                          |
| --------------- | ---------- | ------------------------------------------------------------------------------ |
| `from`          | `text`     | required, indexed. The path to match, or the regex source for `regex` rules     |
| `matchType`     | `select`   | `exact` \| `prefix` \| `regex` (default `exact`)                                |
| `to`            | `text`     | required. Absolute URL or a path starting with `/`                              |
| `status`        | `select`   | `301` \| `302` \| `307` \| `308` (default `307`)                                |
| `preserveQuery` | `checkbox` | default `true`. Forwards the incoming query string                              |
| `enabled`       | `checkbox` | default `true`. Disabled rules are left out of the published rule list          |
| `priority`      | `number`   | default `0`. Higher runs first; equal priorities run oldest first               |

`from` is not unique on its own — the same path is a legitimate `exact` rule *and*
`prefix` rule. The pair `(from, matchType)` carries a compound unique index instead,
and a duplicate is rejected with a readable message rather than a database error.

## Matching

Rules are tried in a fixed order of precedence, and the first match wins:

1. **`exact`** — the whole path, compared after normalization.
2. **`prefix`** — the path and everything under it. Matching is segment-aware, so
   `/blog` matches `/blog` and `/blog/a/b` but never `/blogging`. The leftover
   segments are appended to the destination: `/blog` → `/articles` turns
   `/blog/a/b` into `/articles/a/b`. When several prefixes match, the **longest**
   wins.
3. **`regex`** — a JavaScript regular expression tested against the path.

Within one match type, rules run in `priority` order (descending), then oldest
first. A pattern that no longer compiles is skipped at request time rather than
throwing, so one broken rule cannot take down the site.

Paths are normalized on both sides before matching: a leading slash is added,
repeated slashes are collapsed, and a trailing slash is dropped — so `/a/` and `/a`
are the same rule. The query string and fragment never take part in matching, and
are rejected in `from` on save.

## Destinations

`to` accepts an absolute URL (`https://example.com/new`), a protocol-relative URL
(`//cdn.example.com/new`) or a path starting with `/`.

For `regex` rules the destination is a **full replacement**, not a substitution over
the incoming path, and can reuse captured groups:

| Token       | Means                                    |
| ----------- | ---------------------------------------- |
| `$1` … `$99`| the numbered capture group                |
| `$&`        | the whole match                           |
| `$$`        | a literal `$`                             |

A group that did not participate resolves to an empty string. So
`^/p/(\d+)/(.*)$` → `/posts/$2-$1` turns `/p/12/hello` into `/posts/hello-12`.

With `preserveQuery` on, the incoming query string is appended — but only when the
destination does not already carry one of its own, and any `#fragment` on the
destination stays at the end.

A rule that resolves to the URL the request is already on is skipped rather than
served, so it cannot loop. Exact rules pointing at their own source are rejected at
save time.

## The rules endpoint

The plugin mounts `GET /api/redirections/rules`, a compact and cacheable list of the
enabled rules, in the order the resolver expects:

```jsonc
{
  "version": 1,
  "count": 2,
  "updatedAt": "2026-07-26T09:12:00.000Z",
  "rules": [
    { "from": "/old",  "matchType": "exact",  "to": "/new",      "status": 307, "preserveQuery": true },
    { "from": "/blog", "matchType": "prefix", "to": "/articles", "status": 301, "preserveQuery": true }
  ]
}
```

It sends a weak `ETag` (answering `304` to a matching `If-None-Match`) and
`Cache-Control: public, s-maxage=60, stale-while-revalidate=600` by default, so a CDN
in front of Payload absorbs most of the traffic. Set `endpoint.token` to require an
`x-redirections-token` header — the response then becomes `private, no-store`.

## Requirements

The following dependencies are required to be installed in your project before using this plugin:

- `payload` (`^3.84.1`)

```bash
pnpm add payload
```

The `/next` entry point has **no** dependency on `next` — it types the request
structurally and returns a plain `Response`, so it works on both the Edge and Node.js
runtimes and adds nothing to your bundle.

## Usage

```ts
import { buildConfig } from 'payload'
import { ComposiusPayloadPluginRedirections } from '@composius/payload-plugin-redirections'

export default buildConfig({
  plugins: [ComposiusPayloadPluginRedirections()],
  // ...
})
```

## Next.js

Next 16 renamed `middleware.ts` to `proxy.ts`; the same code works under either name.

```ts
// proxy.ts
import { createRedirectionsProxy } from '@composius/payload-plugin-redirections/next'

export default createRedirectionsProxy({
  // Omit when Payload runs inside this same Next app.
  payloadURL: process.env.NEXT_PUBLIC_PAYLOAD_URL,
})

export const config = {
  // Skip Next internals, the Payload API and admin, and anything with a file
  // extension — none of those can be a content redirection.
  matcher: ['/((?!api|admin|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
```

**Where the rules are fetched from.** `payloadURL`, else `NEXT_PUBLIC_PAYLOAD_URL` or
`PAYLOAD_URL`, else `http://127.0.0.1:$PORT` (`PORT` defaulting to `3000`) — the app
talking to itself, which is what "Payload lives in this same Next app" actually means.
It is deliberately *not* the origin of the incoming request: behind a TLS-terminating
proxy that origin is `https://your-host`, which resolves back inside the network to
this same plain-HTTP listener and fails the handshake with
`ERR_SSL_WRONG_VERSION_NUMBER`. Set `payloadURL` when Payload is a separate service, or
when the proxy runs away from the app — on an edge runtime there is no shared loopback.

To combine it with your own logic, use the returned function directly — it resolves to
a `Response` on a match and `undefined` otherwise:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createRedirectionsProxy } from '@composius/payload-plugin-redirections/next'

const redirections = createRedirectionsProxy()

export default async function proxy(request: NextRequest) {
  const redirected = await redirections(request)
  if (redirected) {
    return redirected
  }

  return requireSession(request) ?? NextResponse.next()
}
```

**Caching.** The rule list is fetched once and kept in module memory for `ttl` seconds
(default 60). Past that, the stale list is served *immediately* while a refresh runs in
the background, so only a cold start ever waits on the network. Concurrent requests
share a single fetch.

**Failure is never fatal.** If the endpoint is unreachable, slow (`timeout`, default
2s), or returns something unexpected, `onError` is called and the request is served
unchanged. The last known rule list keeps working for `staleTtl` seconds (default 600),
and failures are remembered for `retryTtl` seconds (default 10) so a CMS that is down
does not cause a request storm.

The cache is per isolate, so `ttl` is a floor on how fast a change propagates, not a
guarantee. For instant propagation, call `clearRedirectionsCache()` from a revalidation
route handler triggered by an `afterChange` hook.

Only `GET` and `HEAD` requests are ever redirected — 301 and 302 rewrite the method,
which would silently turn a form POST into a GET.

## Using the resolver on its own

`resolveRedirection` is pure and dependency-free, so any runtime can use it — an
Express app, a route handler, a test:

```ts
import { resolveRedirection } from '@composius/payload-plugin-redirections'

const match = resolveRedirection('/blog/hello', rules, '?ref=x')
// → { to: '/articles/hello?ref=x', status: 301, rule: … }
```

## Options

All optional — defaults shown as comments:

```ts
ComposiusPayloadPluginRedirections({
  // Access per operation. Defaults: read = anyone,
  // create/update/delete = authenticated.
  access: { read, create, update, delete },

  // Keeps the collection schema but stops publishing the rules, so nothing
  // redirects (default: false).
  disabled: false,

  // Hides the collection from the admin nav and routes (default: false).
  // Accepts a boolean or ({ user }) => boolean to hide it per user. The
  // collection stays registered, so the schema and the API are unchanged.
  hidden: false,

  // Slug of the collection (default: 'redirections'). Changing it moves the
  // endpoint to /api/<slug>/rules — pass a matching `endpoint` to the proxy.
  slug: 'redirections',

  // The rules endpoint. Pass `false` to skip it entirely.
  endpoint: {
    // Guards the endpoint (default: anyone). An edge proxy carries no session.
    access: anyone,

    // Cache-Control lifetime in seconds (default: 60). 0 sends no-store.
    maxAge: 60,

    // Hard cap on the rules returned (default: 2000).
    maxRules: 2000,

    // Path within the collection route (default: '/rules'), so the public URL
    // is /api/<slug>/rules.
    path: '/rules',

    // Requires this value in an x-redirections-token header. The response then
    // becomes private, no-store (default: unset).
    token: process.env.REDIRECTIONS_TOKEN,
  },
})
```

And the proxy helper:

```ts
createRedirectionsProxy({
  payloadURL: process.env.NEXT_PUBLIC_PAYLOAD_URL, // default: env, then http://127.0.0.1:$PORT
  endpoint: '/api/redirections/rules',             // default
  ttl: 60,          // seconds the rules stay fresh
  staleTtl: 600,    // extra seconds a stale list is served while refreshes fail
  retryTtl: 10,     // seconds a failure is remembered before retrying
  timeout: 2000,    // milliseconds before the fetch is aborted
  token: undefined, // matches the endpoint's `token`
  maxHops: 1,       // collapse chained rules (A → B → C) into one response
  debugHeader: true,// send x-redirection-source naming the matched rule
  skip: undefined,  // (request) => boolean, to bypass the lookup
  onError: undefined,
})
```

## Non-goals

No relationships to other collections, no hit counters or analytics, and no automatic
cache purge on save — `clearRedirectionsCache()` plus a revalidation route covers that
without the plugin guessing your deployment topology.

## Development

From the monorepo root:

```bash
pnpm install
pnpm dev:redirections                                        # dev Payload app with this plugin
pnpm vitest run packages/payload-plugin-redirections/test    # unit tests
pnpm vitest run dev/configs/redirections                     # integration tests
pnpm --filter @composius/payload-plugin-redirections build   # build to dist/
```

See the [root README](../../README.md) for the release flow.
