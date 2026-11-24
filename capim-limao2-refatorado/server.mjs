import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const root = resolve(process.cwd(), 'dist');
const rootReal = await realpath(root);
const port = Number.parseInt(process.env.PORT ?? '3000', 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT precisa ser um número entre 1 e 65535.');
}

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);
const knownPage = (pathname) => pathname === '/' ||
  ['/produtos', '/carrinho', '/sobre', '/contato'].includes(pathname) ||
  /^\/produto\/[^/]+$/.test(pathname) || /^\/admin(?:\/.*)?$/.test(pathname);

function sendText(response, status, text) {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(text);
}

async function sendFile(response, filePath, method, status = 200) {
  const actualPath = await realpath(filePath);
  if (actualPath !== rootReal && !actualPath.startsWith(`${rootReal}${sep}`)) {
    sendText(response, 403, 'Forbidden');
    return;
  }
  const fileInfo = await stat(actualPath);
  if (!fileInfo.isFile()) {
    sendText(response, 404, 'Not found');
    return;
  }
  const relativePath = actualPath.slice(rootReal.length).split(sep).join('/');
  const hashedAsset = relativePath.startsWith('/assets/');
  response.writeHead(status, {
    'Cache-Control': hashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
    'Content-Length': fileInfo.size,
    'Content-Type': contentTypes.get(extname(actualPath).toLowerCase()) ?? 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
  });
  if (method === 'HEAD') {
    response.end();
    return;
  }
  createReadStream(actualPath).on('error', () => response.destroy()).pipe(response);
}

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    sendText(response, 405, 'Method not allowed');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  } catch {
    sendText(response, 400, 'Bad request');
    return;
  }
  if (pathname.includes('\0') || pathname.includes('\\')) {
    sendText(response, 400, 'Bad request');
    return;
  }
  if (pathname === '/_app/health') {
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  const candidate = resolve(rootReal, `.${pathname}`);
  if (candidate !== rootReal && !candidate.startsWith(`${rootReal}${sep}`)) {
    sendText(response, 403, 'Forbidden');
    return;
  }
  try {
    const info = await stat(candidate);
    const pageFile = info.isDirectory() ? resolve(candidate, 'index.html') : candidate;
    await sendFile(response, pageFile, request.method);
    return;
  } catch (error) {
    if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') {
      sendText(response, 500, 'Internal server error');
      return;
    }
  }

  if (knownPage(pathname)) {
    try {
      await sendFile(response, resolve(rootReal, 'index.html'), request.method);
      return;
    } catch {
      sendText(response, 500, 'Internal server error');
      return;
    }
  }

  try {
    await sendFile(response, resolve(rootReal, '404.html'), request.method, 404);
  } catch {
    sendText(response, 404, 'Not found');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Capim Limão web server listening on port ${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
