import { defineConfig } from 'tsup'

/**
 * Two builds: the server entry (plugin + collections + job task) and the
 * client entry (the masked application-password field). Peer dependencies
 * (payload, @payloadcms/*, react) stay external.
 */
const common = {
  clean: false,
  dts: true,
  format: 'esm' as const,
  outDir: 'dist',
  sourcemap: true,
  splitting: false,
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
