import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind 0.0.0.0 so WebContainer can emit `server-ready` and proxy the iframe.
    host: true,
    port: 5173,
    // Vite 5.4+/6 block unknown hosts; the preview iframe is *.webcontainer-api.io.
    allowedHosts: true,
    watch: {
      usePolling: true,
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
