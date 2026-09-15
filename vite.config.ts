/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // Compile every screen as soon as the dev server starts, so the first click on a
    // feature does not wait for Babel and the React Compiler to transform it.
    warmup: {
      clientFiles: ['./src/app/**/*.tsx', './src/features/**/*.tsx', './src/components/**/*.tsx'],
    },
  },
  // Find every dependency up front: one discovered late forces a full page reload in dev.
  optimizeDeps: {
    entries: ['index.html', 'src/**/*.tsx'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    passWithNoTests: true,
    css: false,
  },
})
