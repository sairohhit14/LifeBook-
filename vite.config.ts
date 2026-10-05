import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    // Pre-bundle the full import graph's deps at server start. Without this
    // Vite discovers them on demand during the first page load — slow first
    // paint plus a mid-load auto-reload when deps are re-optimized.
    optimizeDeps: {
      include: [
        "react",
        "react-dom/client",
        "lucide-react",
        "firebase/app",
        "firebase/auth",
      ],
      // Don't stall the first page load waiting for a fresh crawl to finish.
      holdUntilCrawlEnd: false,
    },
    build: {
      rollupOptions: {
        output: {
          // Split heavy vendor libs into cacheable chunks so app-code changes
          // don't invalidate the whole bundle (clears the >500 kB warning).
          manualChunks(id: string) {
            if (!/[\\/]node_modules[\\/]/.test(id)) return undefined;
            if (id.includes('firebase')) return 'firebase';
            if (/[\\/]react(-dom)?[\\/]|[\\/]scheduler[\\/]/.test(id)) return 'react';
            return 'vendor';
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: ['**/db.json', '**/uploads/**']
      },
      proxy: {
        '/api': {
          target: `http://localhost:${process.env.PORT || 3000}`,
          changeOrigin: true,
        },
        '/uploads': {
          target: `http://localhost:${process.env.PORT || 3000}`,
          changeOrigin: true,
        },
      },
    },
  };
});
