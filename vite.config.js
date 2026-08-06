import { defineConfig } from 'vite';

export default defineConfig({
  root: 'Memorization UI',
  base: './',
  server: {
    port: 8000,
    open: '/index.html'
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'Memorization UI/index.html',
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]'
      }
    }
  }
});
