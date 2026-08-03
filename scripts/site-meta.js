#!/usr/bin/env node
// Generates robots.txt, sitemap.xml, site.webmanifest, and deploy headers from site.config.json

const fs = require('fs');
const path = require('path');
const { buildContentSecurityPolicy, buildHeadersFile, buildMetaContentSecurityPolicy } = require('./security-policy');

const ROOT = path.join(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));

const siteUrl = config.siteUrl.replace(/\/$/, '');
const today = new Date().toISOString().slice(0, 10);
const cspMeta = buildMetaContentSecurityPolicy();

const LANDING_PAGES = [
  {
    slug: 'text-file',
    dir: 'text-file',
    title: 'Text / File Deduplication',
    description: 'Remove duplicate lines from pasted text, CSV, Excel, JSON, logs, code, and todo lists in your browser. No uploads, 100% private.',
    h1: 'Text and file deduplication',
    lead: 'Paste or upload text and spreadsheets. Geckodupe removes duplicate rows and lines locally in your browser — Excel, CSV, JSON, logs, code, and more.',
    keywords: 'text deduplication, remove duplicate lines, csv dedupe, excel duplicate rows, json dedupe, log deduplication'
  },
  {
    slug: 'folder-zip',
    dir: 'folder-zip',
    title: 'Folder / Zip Deduplication',
    description: 'Deduplicate files and lines inside project folders and zip archives. Skip node_modules, download a cleaned zip. Runs entirely in your browser.',
    h1: 'Folder and zip archive deduplication',
    lead: 'Load a project folder or zip archive. Geckodupe fingerprints files, removes byte-identical copies, and deduplicates lines inside each file — with configurable skip paths.',
    keywords: 'folder deduplication, zip dedupe, remove duplicate files, project cleanup, archive deduplication'
  },
  {
    slug: 'image-video',
    dir: 'image-video',
    title: 'Image / Video Deduplication',
    description: 'Find duplicate and near-duplicate photos and videos by visual content, not filename. Burst frames, resized copies, reference-target mode. 100% local.',
    h1: 'Image and video library deduplication',
    lead: 'Drop a folder or zip of photos and videos. Geckodupe compares visual fingerprints to collapse burst shots, resized exports, and near-duplicate clips — with optional reference-target mode.',
    keywords: 'photo deduplication, duplicate images, video dedupe, near duplicate photos, burst photo cleanup'
  }
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function appHashUrl(slug) {
  return '../#' + slug;
}

function buildLandingPage(page) {
  const pageUrl = siteUrl + '/' + page.dir + '/';
  const appUrl = appHashUrl(page.slug);
  const redirectScript = 'location.replace(new URL(' + JSON.stringify(appUrl) + ', location.href).href)';
  const iconUrl = siteUrl + '/public/icon-512.png';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: config.name + ' — ' + page.title,
    url: pageUrl,
    description: page.description,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Web browser',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    isAccessibleForFree: true
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(page.title)} — ${escapeHtml(config.name)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${escapeHtml(page.description)}">
  <meta name="keywords" content="${escapeHtml(page.keywords)}">
  <meta name="robots" content="index, follow">
  <meta name="application-name" content="${escapeHtml(config.name)}">
  <meta name="theme-color" content="${escapeHtml(config.themeColor)}">
  <link rel="canonical" href="${pageUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${escapeHtml(config.name)}">
  <meta property="og:title" content="${escapeHtml(page.title)} — ${escapeHtml(config.name)}">
  <meta property="og:description" content="${escapeHtml(page.description)}">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:image" content="${iconUrl}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(page.title)} — ${escapeHtml(config.name)}">
  <meta name="twitter:description" content="${escapeHtml(page.description)}">
  <meta name="twitter:image" content="${iconUrl}">
  <meta http-equiv="refresh" content="0;url=${appUrl}">
  <link rel="icon" type="image/x-icon" href="../public/favicon.ico">
  <link rel="icon" type="image/png" sizes="192x192" href="../public/icon-192.png">
  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem auto; max-width: 42rem; line-height: 1.5; color: #333; padding: 0 1rem; }
    h1 { font-size: 1.5rem; }
    a { color: #5a6b1a; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(page.h1)}</h1>
    <p>${escapeHtml(page.lead)}</p>
    <p>Redirecting to <a href="${appUrl}">${escapeHtml(config.name)} ${escapeHtml(page.title)}</a>…</p>
  </main>
  <script>${redirectScript};</script>
</body>
</html>
`;
}

function writeLandingPages() {
  LANDING_PAGES.forEach(function (page) {
    const dir = path.join(ROOT, page.dir);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), buildLandingPage(page));
  });
}

const sitemapUrls = [
  { loc: siteUrl + '/', priority: '1.0' }
].concat(LANDING_PAGES.map(function (page) {
  return { loc: siteUrl + '/' + page.dir + '/', priority: '0.9' };
}));

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map(function (entry) {
  return `  <url>
    <loc>${entry.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${entry.priority}</priority>
  </url>`;
}).join('\n')}
</urlset>
`;

const robots = [
  'User-agent: *',
  'Allow: /',
  '',
  'Disallow: /404.html',
  'Disallow: /node_modules/',
  'Disallow: /tests/',
  '',
  `Sitemap: ${siteUrl}/sitemap.xml`,
  ''
].join('\n');

const manifest = {
  name: config.name,
  short_name: config.shortName,
  description: config.description,
  start_url: './#text-file',
  scope: './',
  display: 'standalone',
  background_color: config.backgroundColor,
  theme_color: config.themeColor,
  icons: [
    { src: 'public/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'public/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'public/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ]
};

const security = [
  'Contact: ' + config.contact,
  'Preferred-Languages: en',
  'Policy: ' + siteUrl + '/.well-known/security.txt',
  ''
].join('\n');

fs.writeFileSync(path.join(ROOT, 'robots.txt'), robots);
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap);
fs.writeFileSync(path.join(ROOT, 'site.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(ROOT, '_headers'), buildHeadersFile());

const wellKnownDir = path.join(ROOT, '.well-known');
if (!fs.existsSync(wellKnownDir)) fs.mkdirSync(wellKnownDir);
fs.writeFileSync(path.join(wellKnownDir, 'security.txt'), security);

const humans = [
  '/* TEAM */',
  'Project: Geckodupe',
  'Site: ' + siteUrl,
  'GitHub: ' + config.contact,
  '',
  '/* THANKS */',
  'Everyone who deduplicates responsibly.',
  ''
].join('\n');
fs.writeFileSync(path.join(ROOT, 'humans.txt'), humans);

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: config.name,
  url: siteUrl + '/',
  description: config.description,
  applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'Web browser',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  browserRequirements: 'Requires a modern browser with JavaScript enabled',
  isAccessibleForFree: true
};

const indexPath = path.join(ROOT, 'index.html');
let index = fs.readFileSync(indexPath, 'utf8');
index = index.replace(
  /<link rel="canonical" href="[^"]*">/,
  `<link rel="canonical" href="${siteUrl}/">`
);
index = index.replace(
  /<meta property="og:url" content="[^"]*">/,
  `<meta property="og:url" content="${siteUrl}/">`
);
index = index.replace(
  /<meta property="og:image" content="[^"]*">/,
  `<meta property="og:image" content="${siteUrl}/public/icon-512.png">`
);
index = index.replace(
  /<meta name="twitter:image" content="[^"]*">/,
  `<meta name="twitter:image" content="${siteUrl}/public/icon-512.png">`
);
index = index.replace(
  /<meta http-equiv="Content-Security-Policy" content="[^"]*">/,
  `<meta http-equiv="Content-Security-Policy" content="${cspMeta}">`
);
index = index.replace(
  /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
  `<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n  </script>`
);
fs.writeFileSync(indexPath, index);

writeLandingPages();

process.stdout.write('site-meta: wrote robots.txt, sitemap.xml, site.webmanifest, _headers, humans.txt, .well-known/security.txt, and 3 SEO landing pages\n');
