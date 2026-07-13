import { defineConfig } from 'tsup'

/**
 * The private @vitrailweb/payload-plugin-shared-components package is inlined
 * into dist/ (JS via the devDependency, types via the tsconfig `paths`
 * mapping), so the published package has no dependency on it. Peer
 * dependencies (payload, @payloadcms/*) stay external.
 */
const common = {
  format: 'esm' as const,
  dts: true,
  sourcemap: true,
  outDir: 'dist',
  splitting: false,
  clean: false,
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
])
