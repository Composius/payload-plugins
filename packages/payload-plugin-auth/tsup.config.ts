import { defineConfig } from 'tsup'

export default defineConfig({
  format: 'esm',
  dts: true,
  sourcemap: true,
  outDir: 'dist',
  splitting: false,
  clean: false,
  entry: { index: 'src/index.ts' },
})
