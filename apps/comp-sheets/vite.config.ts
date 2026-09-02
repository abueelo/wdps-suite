import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  base: '/comp-sheets/',
  plugins: [svelte()],
  build: {
    outDir: 'dist',
    target: 'es2022'
  },
  worker: {
    format: 'es'
  }
});
