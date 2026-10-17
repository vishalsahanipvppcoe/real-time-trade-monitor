import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/getTrades': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/pulls': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/events': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
