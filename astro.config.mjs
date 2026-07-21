import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';

import react from '@astrojs/react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// https://astro.build/config
export default defineConfig({
  site: 'https://chenrunsen.cn',
  scopedStyleStrategy: 'class',

  server: {
    host: true,
  },

  vite: {
    server: {
      proxy: {
        // Local dev: forward API calls through the SSH tunnel to production
        '/api': {
          target: 'http://localhost:18080',
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: {
        '@/': `${path.resolve(__dirname, 'src')}/`
      }
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@use 'sass:math'; @use 'sass:map'; @use "@/styles/import" as *;`
        }
      }
    },
    build: {
      assetsInlineLimit: 0
    }
  },

  devToolbar: {
    enabled: false
  },

  integrations: [react()]
});