import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The app lives in webapp/; sample-data/ sits one level up and is loaded by
// the "Load sample data" button, so the dev server may read the repo root.
export default defineConfig({
  root: 'webapp',
  plugins: [react()],
  server: { fs: { allow: ['..'] } },
  build: { outDir: '../dist', emptyOutDir: true },
});
