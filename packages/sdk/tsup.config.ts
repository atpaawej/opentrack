import { defineConfig } from 'tsup';

export default defineConfig([
  // ESM & CJS libraries for bundlers/npm
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    minify: true,
    sourcemap: true,
  },
  // Standalone IIFE bundle for <script> tags
  {
    entry: {
      opentrack: 'src/index.ts',
    },
    format: ['iife'],
    globalName: 'opentrack',
    minify: true,
    treeshake: true,
    outExtension() {
      return { js: '.min.js' };
    },
    sourcemap: false,
    clean: false,
  },
]);
