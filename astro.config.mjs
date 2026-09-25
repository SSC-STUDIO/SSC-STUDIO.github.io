import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import fs from 'node:fs';
import net from 'node:net';

import react from '@astrojs/react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_TUNNEL_PORT = 18080;

/**
 * Dev-only guard in front of the `/api` proxy.
 *
 * The proxy target is an SSH tunnel to production which is often not
 * running locally. Without this guard every `/api/*` request crashes in
 * the proxy with a noisy ECONNREFUSED stack trace. Here we probe the
 * tunnel port (cached for a few seconds) and answer a clean 503 JSON
 * when it is down, so islands can degrade gracefully and the console
 * stays quiet.
 */
function apiTunnelFallback() {
  let lastProbe = 0;
  let tunnelUp = false;
  const PROBE_TTL = 5000;

  const probe = () =>
    new Promise((resolve) => {
      const socket = net.connect({ host: '127.0.0.1', port: API_TUNNEL_PORT });
      let settled = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(ok);
      };
      socket.setTimeout(400);
      socket.once('connect', () => done(true));
      socket.once('timeout', () => done(false));
      socket.once('error', () => done(false));
    });

  return {
    name: 'api-tunnel-fallback',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();

        const now = Date.now();
        if (now - lastProbe > PROBE_TTL) {
          tunnelUp = await probe();
          lastProbe = now;
        }
        if (tunnelUp) return next();

        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(
          JSON.stringify({
            error: 'api_unavailable',
            hint: `SSH tunnel to production API (127.0.0.1:${API_TUNNEL_PORT}) is not running`,
          })
        );
      });
    },
  };
}

/**
 * Dev-only: serve `public/<dir>/index.html` for `/<dir>/` and `/<dir>`.
 *
 * GitHub Pages resolves directory URLs to their index.html, so the
 * standalone letters under public/ (mini-love, mid-autumn) are linked as
 * `/mini-love/`. The Astro dev server does not do that lookup for public
 * files and answers 404 instead.
 */
function publicDirectoryIndex() {
  const publicDir = path.resolve(__dirname, 'public');

  return {
    name: 'public-directory-index',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (!req.url) return next();
        const [pathname, query = ''] = req.url.split('?');
        if (path.extname(pathname)) return next();

        const dir = decodeURIComponent(pathname).replace(/\/+$/, '');
        if (!dir) return next();

        const indexFile = path.join(publicDir, dir, 'index.html');
        if (!indexFile.startsWith(publicDir) || !fs.existsSync(indexFile)) return next();

        req.url = `${dir}/index.html${query ? `?${query}` : ''}`;
        next();
      });
    },
  };
}

// https://astro.build/config
export default defineConfig({
  site: 'https://ssc-studio.github.io',
  scopedStyleStrategy: 'class',

  server: {
    host: true,
  },

  vite: {
    plugins: [apiTunnelFallback(), publicDirectoryIndex()],
    server: {
      proxy: {
        // Local dev: forward API calls through the SSH tunnel to production
        '/api': {
          target: `http://127.0.0.1:${API_TUNNEL_PORT}`,
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
      assetsInlineLimit: 0,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/three')) return 'three'
          },
        },
      },
    }
  },

  devToolbar: {
    enabled: false
  },

  integrations: [react()]
});
