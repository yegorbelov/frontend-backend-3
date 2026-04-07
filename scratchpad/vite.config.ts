import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/subscribe': { target: 'http://localhost:3001', changeOrigin: true },
      '/unsubscribe': { target: 'http://localhost:3001', changeOrigin: true },
      '/vapid-public': { target: 'http://localhost:3001', changeOrigin: true },
      '/snooze': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
});
