import { defineConfig } from 'tsup'

/**
 * Two builds: the server entry (plugin + collections + job task) and the
 * client entry (the masked application-password field). Peer dependencies
 * (payload, @payloadcms/*, react) stay external.
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
