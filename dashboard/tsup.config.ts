import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['server/cli.ts'],
  outDir: 'dist',
  format: ['esm'],
  target: 'node20',
  bundle: true,
  splitting: false,
  clean: false, // Don't clean dist/ — vite build output is there
  sourcemap: false,
  dts: false,
  external: [
    'express',
    'cors',
    'ws',
    'open',
    'node-pty',
  ],
})
