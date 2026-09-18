import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: '../dist-standalone',
    emptyOutDir: true,
    rollupOptions: {
      input: 'index.standalone.html'
    }
  }
});