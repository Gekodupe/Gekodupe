#!/usr/bin/env node
// Minimal static file server for Playwright e2e tests

const http = require('http');
const fs = require('fs');
const path = require('path');
const { getSecurityHeaders } = require('./security-policy');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 4173;
const USE_MINIFIED = process.env.USE_MINIFIED === '1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const SECURITY_HEADERS = getSecurityHeaders({
  upgradeInsecure: false,
  hsts: false
});

function resolveAssetPath(filePath) {
  if (!USE_MINIFIED) return filePath;
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.js' && ext !== '.css') return filePath;
  const minPath = filePath.replace(/\.(js|css)$/, '.min.$1');
  if (fs.existsSync(minPath)) return minPath;
  return filePath;
}

function resolveRequestPath(urlPath) {
  if (urlPath === '/') return path.join(ROOT, 'index.html');
  let base = path.normalize(path.join(ROOT, urlPath));
  if (!base.startsWith(ROOT)) return null;
  try {
    if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
      base = path.join(base, 'index.html');
    } else if (!path.extname(urlPath)) {
      const withIndex = path.join(base, 'index.html');
      if (fs.existsSync(withIndex)) base = withIndex;
    }
  } catch (_) { /* fall through */ }
  return resolveAssetPath(base);
}

http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const filePath = resolveRequestPath(urlPath);
  if (!filePath) {
    res.writeHead(403, SECURITY_HEADERS);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        const notFoundPath = path.join(ROOT, '404.html');
        fs.readFile(notFoundPath, (nfErr, nfData) => {
          if (nfErr) {
            res.writeHead(404, SECURITY_HEADERS);
            res.end('Not found');
            return;
          }
          const headers = Object.assign({}, SECURITY_HEADERS, {
            'Content-Type': 'text/html; charset=utf-8'
          });
          res.writeHead(404, headers);
          res.end(nfData);
        });
        return;
      }
      res.writeHead(500, SECURITY_HEADERS);
      res.end('Error');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const cacheable = ['.js', '.css', '.svg', '.png', '.ico', '.json', '.woff2'];
    const headers = Object.assign({}, SECURITY_HEADERS, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': cacheable.includes(ext) ? 'public, max-age=31536000, immutable' : 'no-cache'
    });
    res.writeHead(200, headers);
    res.end(data);
  });
}).listen(PORT, '127.0.0.1', () => {
  process.stdout.write('ready\n');
});
