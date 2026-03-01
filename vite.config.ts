import path from 'node:path';
import fs from 'node:fs/promises';
import { transform } from 'esbuild';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

function normalizeUrlPart(part: string): string {
  if (!part) return '/';
  if (!part.startsWith('/')) return `/${part}`;
  return part;
}

async function recursiveFiles(dir: string, base: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await recursiveFiles(full, base)));
      continue;
    }
    out.push(`/${path.relative(base, full).replace(/\\/g, '/')}`);
  }
  return out;
}

function pwaBuildPlugin(): Plugin {
  const root = process.cwd();
  const srcPwa = path.resolve(root, 'src/pwa');
  const iconsSrc = path.resolve(srcPwa, 'icons');

  return {
    name: 'arcade-pwa-builder',
    async configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) {
          next();
          return;
        }

        if (req.url === '/manifest.webmanifest') {
          const manifest = await fs.readFile(path.resolve(srcPwa, 'manifest.json'), 'utf-8');
          res.setHeader('Content-Type', 'application/manifest+json');
          res.end(manifest);
          return;
        }

        if (req.url.startsWith('/icons/')) {
          const iconPath = path.resolve(iconsSrc, req.url.replace('/icons/', ''));
          try {
            const icon = await fs.readFile(iconPath);
            res.setHeader('Content-Type', iconPath.endsWith('.svg') ? 'image/svg+xml' : 'image/png');
            res.end(icon);
            return;
          } catch {
            next();
            return;
          }
        }

        if (req.url === '/sw.js') {
          const source = await fs.readFile(path.resolve(srcPwa, 'service-worker.ts'), 'utf-8');
          const compiled = await transform(source.replace('__PRECACHE_ASSETS__', '[]'), {
            loader: 'ts',
            format: 'esm',
            target: 'es2020',
          });
          res.setHeader('Content-Type', 'application/javascript');
          res.end(compiled.code);
          return;
        }

        next();
      });
    },
    async closeBundle() {
      const dist = path.resolve(root, 'dist');
      await fs.mkdir(path.join(dist, 'icons'), { recursive: true });

      const iconNames = await fs.readdir(iconsSrc);
      await Promise.all(
        iconNames.map((name) =>
          fs.copyFile(path.join(iconsSrc, name), path.join(dist, 'icons', name)),
        ),
      );

      const manifestRaw = await fs.readFile(path.resolve(srcPwa, 'manifest.json'), 'utf-8');
      const manifest = JSON.parse(manifestRaw) as Record<string, unknown>;
      manifest.start_url = './';
      manifest.scope = './';
      await fs.writeFile(path.join(dist, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));

      const distFiles = await recursiveFiles(dist, dist);
      const precacheAssets = distFiles
        .filter((item) => !item.endsWith('/sw.js'))
        .map((item) => `.${item}`)
        .sort();

      const swSource = await fs.readFile(path.resolve(srcPwa, 'service-worker.ts'), 'utf-8');
      const swWithAssets = swSource.replace('__PRECACHE_ASSETS__', JSON.stringify(precacheAssets));
      const compiled = await transform(swWithAssets, {
        loader: 'ts',
        format: 'esm',
        target: 'es2020',
      });

      await fs.writeFile(path.join(dist, 'sw.js'), compiled.code, 'utf-8');
    },
  };
}

export default defineConfig(({ mode }) => {
  const rootDir = process.cwd();
  const base = normalizeUrlPart(process.env.BASE_PATH ?? '/');
  return {
    base,
    plugins: [react(), pwaBuildPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, 'src'),
      },
    },
    build: {
      target: 'es2020',
    },
    server: {
      host: true,
      port: 5173,
    },
    preview: {
      host: true,
      port: 4173,
    },
  };
});
