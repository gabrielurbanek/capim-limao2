import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function previewHttp404(): Plugin {
  return {
    name: 'capim-limao-preview-http-404',
    configurePreviewServer(server) {
      const dist = path.resolve(process.cwd(), 'dist');
      server.middlewares.use((request, response, next) => {
        if (request.method !== 'GET' && request.method !== 'HEAD') { next(); return; }
        let pathname: string;
        try { pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://preview.local').pathname); }
        catch { pathname = ''; }
        const target = path.resolve(dist, `.${pathname}`);
        const insideDist = target === dist || target.startsWith(`${dist}${path.sep}`);
        const existsAsFile = insideDist && fs.existsSync(target) && fs.statSync(target).isFile();
        const indexFile = insideDist && path.join(target, 'index.html');
        const existsAsDirectoryPage = Boolean(indexFile && fs.existsSync(indexFile) && fs.statSync(indexFile).isFile());
        if (insideDist && (existsAsFile || existsAsDirectoryPage)) { next(); return; }
        const notFound = path.join(dist, '404.html');
        response.statusCode = 404;
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        if (request.method === 'HEAD') { response.end(); return; }
        response.end(fs.existsSync(notFound) ? fs.readFileSync(notFound) : 'Página não encontrada.');
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), previewHttp404()],
  server: { host: '0.0.0.0', port: 3000, strictPort: true },
  preview: { host: '0.0.0.0', port: 3000, strictPort: true },
});
