// tsup.config.ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  outDir: 'dist',
  bundle: true,
  minify: false,
  clean: true,
  noExternal: [/.*/],  // <-- bundle EVERYTHING, no external deps
})