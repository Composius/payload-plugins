import { defineConfig } from 'tsup'

export default defineConfig({
  clean: false,
  dts: true,
  entry: { index: 'src/index.ts' },
  format: 'esm',
  outDir: 'dist',
  sourcemap: true,
  splitting: false,
})
