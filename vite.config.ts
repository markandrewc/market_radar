/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  root: 'src/web',
  envDir: '../..',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src/web') } },
  build: { outDir: '../../dist', emptyOutDir: true },
  test: { environment: 'jsdom', env: { VITE_USE_MOCKS: '1', VITE_MOCK_SCENARIO: 'normal' }, include: ['tests/**/*.test.tsx'] },
  server: { proxy: { '/api/': 'http://localhost:8787' } },
});
