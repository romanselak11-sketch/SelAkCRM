import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const root = path.dirname(fileURLToPath(import.meta.url));
const crmSrc = path.resolve(root, '../../frontend/src');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@crm': crmSrc,
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://127.0.0.1:8766',
    },
  },
});
