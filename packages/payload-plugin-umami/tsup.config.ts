import { defineConfig } from 'tsup'

/**
 * Two builds: the server entry (plugin + endpoint + Umami client) and the
 * client entry (the dashboard components). Peer dependencies (payload,
 * @payloadcms/*, react, recharts) stay external.
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
  {
    ...common,
    entry: { 'exports/rsc': 'src/exports/rsc.ts' },
    // The client components are imported via the package's own /client
    // subpath, which stays external — the rsc bundle contains no client code.
    external: ['@composius/payload-plugin-umami/client'],
  },
])
