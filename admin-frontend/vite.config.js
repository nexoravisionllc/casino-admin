import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Admin dev server on port 5174, proxying API calls to the Admin backend.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:5100',
        changeOrigin: true,
      },
      // Live updates: the SignalR wallet hub (WebSockets) on the admin backend.
      '/hubs': {
        target: 'http://localhost:5100',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
