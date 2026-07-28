import { defineConfig } from 'tsup'

/**
 * The private @composius/payload-plugin-shared-components package is inlined
 * into dist/ (JS via the devDependency, types via the tsconfig `paths`
 * mapping), so the published package has no dependency on it. Peer
 * dependencies (payload, @payloadcms/*) stay external.
 *
 * `next` is an optional peer, imported dynamically by the revalidation hooks:
 * listing it keeps esbuild from following that import and bundling the
 * framework into dist/.
 */
const common = {
  format: 'esm' as const,
  dts: true,
  sourcemap: true,
  outDir: 'dist',
  splitting: false,
  clean: false,
  external: [/^next(\/|$)/],
}

export default defineConfig([
  {
    ...common,
    entry: { index: 'src/index.ts' },
  },
  {
    ...common,
    entry: { 'exports/client': 'src/exports/client.ts' },
    // esbuild drops the "use client" directive when bundling; re-add it.
    banner: { js: "'use client'" },
  },
  {
    ...common,
    entry: { 'exports/tags': 'src/exports/tags.ts' },
  },
])
