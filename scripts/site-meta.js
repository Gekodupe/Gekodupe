#!/usr/bin/env node
// Generates robots.txt, sitemap.xml, site.webmanifest, and deploy headers from site.config.json

const fs = require('fs');
const path = require('path');
const { buildContentSecurityPolicy, buildHeadersFile, buildMetaContentSecurityPolicy } = require('./security-policy');

const ROOT = path.join(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));

const siteUrl = config.siteUrl.replace(/\/$/, '');
const brandName = config.brandName || (config.name + ' by Flareform');
const today = new Date().toISOString().slice(0, 10);
const cspMeta = buildMetaContentSecurityPolicy();
const iconUrl = siteUrl + (config.ogImage || '/public/icon-512.png');
const publisher = config.publisher || { name: 'Flareform', url: 'https://flareform.com' };
const sameAs = Array.isArray(config.sameAs) ? config.sameAs : [];
const locale = config.locale || 'en_US';
const ogImageWidth = config.ogImageWidth || 512;
const ogImageHeight = config.ogImageHeight || 512;

const LANDING_PAGES = [
  {
    slug: 'text-file',
    dir: 'text-file',
    title: 'Text / File Deduplication',
    description: 'Normalize and remove duplicate lines from pasted text, CSV, Excel, JSON, logs, code, and todo lists in your browser. No uploads, 100% private.',
    h1: 'Text and file normalization',
    lead: 'Paste or upload text and spreadsheets. Geckodupe normalizes rows so they become comparable, then keeps one canonical copy. Excel, CSV, JSON, logs, code, and more.',
    keywords: 'text normalization, text deduplication, remove duplicate lines, csv dedupe, excel duplicate rows, json dedupe, log deduplication'
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
  },
  {
    slug: 'spam',
    dir: 'spam',
    title: 'Spam Prevention',
    description: 'Normalize and despam form dumps, logs, and lists in your browser. Score honeypots, URL floods, disposable mail, bait, and near-duplicate bursts. 100% local.',
    h1: 'Spam prevention and list despam',
    lead: 'Paste form payloads, log lines, or mailing lists. Geckodupe normalizes them so retries and floods become comparable, then strips spam so you keep real submissions.',
    keywords: 'spam prevention, form spam, despam logs, honeypot detection, disposable email, bait detection, normalization'
  },
  {
    slug: 'api',
    dir: 'api',
    title: 'API Access',
    description: 'Create Geckodupe API keys for hosted normalization, despam, spam prevention, and event idempotency. View usage charts after signing in on Account.',
    h1: 'Geckodupe API',
    lead: 'Keys and usage for Express, Fastify, Hono, Bun, Workers, or Node. Sign in on Account first. No Cloudflare setup on your side.',
    keywords: 'geckodupe api, api key, spam prevention api, idempotency api, form spam api'
  },
  {
    slug: 'pricing',
    dir: 'pricing',
    title: 'Pricing',
    description: 'Geckodupe plans for local tools and hosted API. Guest soft caps, Free starter API, Starter, Pro, and Business via Stripe. Cancel anytime in the customer portal.',
    h1: 'Geckodupe pricing',
    lead: 'Try locally as a guest, sign in for Free API allowance, or upgrade for production volume. Billing by Stripe — edit or cancel anytime.',
    keywords: 'geckodupe pricing, spam api pricing, form spam plans, geckodupe subscription'
  },
  {
    slug: 'account',
    dir: 'account',
    title: 'Account',
    description: 'Sign in to Geckodupe, verify email, manage billing, and return to your API keys. Secure sessions with password or magic link.',
    h1: 'Geckodupe account',
    lead: 'Create an account or sign back in. Manage Stripe billing, verify email, and open the API tab for keys.',
    keywords: 'geckodupe account, sign in, billing portal, verify email'
  },
  {
    slug: 'docs',
    dir: 'docs-landing',
    title: 'Geckodupe Docs',
    description: 'Geckodupe API documentation: quick start, SDK, spam and events endpoints, plans, security, and local tools.',
    h1: 'Geckodupe Docs',
    lead: 'Everything you need to use the Geckodupe API and browser tools. Straight answers, full coverage.',
    keywords: 'geckodupe docs, api documentation, spam api docs, geckodupe sdk'
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
  // Spam landing avoids em dashes in titles and visible copy
  const titleJoin = page.slug === 'spam' ? ' - ' : ' — ';
  const pageTitleFull = page.title + titleJoin + brandName;
  const appTitleFull = brandName + titleJoin + page.title;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        '@id': pageUrl + '#app',
        name: appTitleFull,
        url: pageUrl,
        description: page.description,
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Web browser',
        browserRequirements: 'Requires a modern browser with JavaScript enabled',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        isAccessibleForFree: true,
        publisher: { '@type': 'Organization', name: publisher.name, url: publisher.url },
        isPartOf: { '@id': siteUrl + '/#website' }
      },
      {
        '@type': 'BreadcrumbList',
        '@id': pageUrl + '#breadcrumb',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: brandName, item: siteUrl + '/' },
          { '@type': 'ListItem', position: 2, name: page.title, item: pageUrl }
        ]
      },
      {
        '@type': 'WebPage',
        '@id': pageUrl + '#webpage',
        url: pageUrl,
        name: pageTitleFull,
        description: page.description,
        isPartOf: { '@id': siteUrl + '/#website' },
        about: { '@id': pageUrl + '#app' },
        breadcrumb: { '@id': pageUrl + '#breadcrumb' }
      }
    ]
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(pageTitleFull)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${escapeHtml(page.description)}">
  <meta name="keywords" content="${escapeHtml(page.keywords)}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <meta name="googlebot" content="index, follow">
  <meta name="application-name" content="${escapeHtml(brandName)}">
  <meta name="author" content="${escapeHtml(publisher.name)}">
  <meta name="theme-color" content="${escapeHtml(config.themeColor)}">
  <meta name="color-scheme" content="light">
  <link rel="canonical" href="${pageUrl}">
  <link rel="alternate" href="${siteUrl}/#${page.slug}" title="${escapeHtml(page.title)} app view">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="${escapeHtml(locale)}">
  <meta property="og:site_name" content="${escapeHtml(brandName)}">
  <meta property="og:title" content="${escapeHtml(pageTitleFull)}">
  <meta property="og:description" content="${escapeHtml(page.description)}">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:image" content="${iconUrl}">
  <meta property="og:image:width" content="${ogImageWidth}">
  <meta property="og:image:height" content="${ogImageHeight}">
  <meta property="og:image:alt" content="${escapeHtml(brandName)} icon">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(pageTitleFull)}">
  <meta name="twitter:description" content="${escapeHtml(page.description)}">
  <meta name="twitter:image" content="${iconUrl}">
  <meta name="twitter:image:alt" content="${escapeHtml(brandName)} icon">
  <meta http-equiv="refresh" content="0;url=${appUrl}">
  <link rel="icon" type="image/x-icon" href="../public/favicon.ico">
  <link rel="icon" type="image/png" sizes="192x192" href="../public/icon-192.png">
  <link rel="apple-touch-icon" href="../public/icon-192.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap">
  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { height: 100%; }
    body {
      min-height: 100%;
      display: flex;
      flex-direction: column;
      background: #ffffff;
      color: #1a1a1a;
      font-family: 'Poppins', sans-serif;
      font-weight: 400;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    .lp-nav {
      height: 56px;
      background: #1a1a1a;
      color: #fff;
      display: flex;
      align-items: center;
      padding: 0 24px;
      flex-shrink: 0;
    }
    .lp-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      color: inherit;
    }
    .lp-brand img {
      width: 28px;
      height: 28px;
      object-fit: contain;
    }
    .lp-brand-name { font-size: 14px; line-height: 1; color: #fff; }
    .lp-brand-sub {
      font-size: 11px;
      line-height: 1.2;
      color: #a1a1aa;
      letter-spacing: 0.03em;
      margin-top: 2px;
    }
    .lp-wrap {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
    }
    .lp-main { width: 100%; max-width: 560px; }
    .lp-eyebrow {
      font-size: 13px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #f7831e;
      margin-bottom: 12px;
    }
    h1 {
      font-size: 32px;
      font-weight: 400;
      line-height: 1.2;
      margin-bottom: 12px;
      color: #1a1a1a;
    }
    .lp-lead { font-size: 15px; color: #484848; margin-bottom: 24px; }
    .lp-redirect { font-size: 13px; color: #6b7280; }
    .lp-redirect a {
      color: #f7831e;
      text-decoration: none;
      border-bottom: 1px solid rgba(247, 131, 30, 0.35);
    }
    .lp-redirect a:hover { border-bottom-color: #f7831e; }
    .lp-footer {
      padding: 24px;
      text-align: center;
      font-size: 11px;
      color: #6b7280;
      flex-shrink: 0;
    }
    @media (max-width: 480px) {
      .lp-nav { padding: 0 16px; }
      h1 { font-size: 26px; }
      .lp-wrap { padding: 32px 16px; }
    }
  </style>
</head>
<body>
  <header class="lp-nav">
    <a href="${appUrl}" class="lp-brand">
      <img src="../public/logo-white.png" alt="Flareform">
      <div>
        <div class="lp-brand-name">Geckodupe</div>
        <div class="lp-brand-sub">by Flareform</div>
      </div>
    </a>
  </header>
  <div class="lp-wrap">
    <main class="lp-main">
      <p class="lp-eyebrow">Geckodupe</p>
      <h1>${escapeHtml(page.h1)}</h1>
      <p class="lp-lead">${escapeHtml(page.lead)}</p>
      <p class="lp-redirect">Redirecting to <a href="${appUrl}">${escapeHtml(config.name)} ${escapeHtml(page.title)}</a>…</p>
    </main>
  </div>
  <footer class="lp-footer">&copy; 2026 Geckodupe by Flareform</footer>
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
  { loc: siteUrl + '/', priority: '1.0', changefreq: 'weekly' }
].concat(LANDING_PAGES.map(function (page) {
  return { loc: siteUrl + '/' + page.dir + '/', priority: '0.9', changefreq: 'monthly' };
}));

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${sitemapUrls.map(function (entry) {
  return `  <url>
    <loc>${entry.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${entry.changefreq || 'weekly'}</changefreq>
    <priority>${entry.priority}</priority>
    <image:image>
      <image:loc>${iconUrl}</image:loc>
      <image:title>${escapeHtml(brandName)}</image:title>
    </image:image>
  </url>`;
}).join('\n')}
</urlset>
`;

const robots = [
  'User-agent: *',
  'Allow: /',
  'Allow: /text-file/',
  'Allow: /folder-zip/',
  'Allow: /image-video/',
  'Allow: /spam/',
  'Allow: /public/',
  'Allow: /css/',
  'Allow: /js/',
  '',
  'Disallow: /404.html',
  'Disallow: /node_modules/',
  'Disallow: /scripts/',
  'Disallow: /package.json',
  'Disallow: /package-lock.json',
  'Disallow: /site.config.json',
  '',
  '# AI / training crawlers — keep product pages discoverable, block tooling paths',
  'User-agent: GPTBot',
  'Allow: /',
  'Disallow: /scripts/',
  'Disallow: /node_modules/',
  '',
  'User-agent: Google-Extended',
  'Allow: /',
  '',
  `Sitemap: ${siteUrl}/sitemap.xml`,
  `Host: ${siteUrl.replace(/^https?:\/\//, '')}`,
  ''
].join('\n');

const manifest = {
  name: brandName,
  short_name: config.shortName,
  description: config.description,
  start_url: './#text-file',
  scope: './',
  display: 'standalone',
  lang: 'en',
  dir: 'ltr',
  categories: ['utilities', 'productivity'],
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
  'Project: ' + brandName,
  'Site: ' + siteUrl,
  'Publisher: ' + publisher.name + ' (' + publisher.url + ')',
  'GitHub: ' + config.contact,
  '',
  '/* THANKS */',
  'Everyone who deduplicates responsibly.',
  ''
].join('\n');
fs.writeFileSync(path.join(ROOT, 'humans.txt'), humans);

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': publisher.url + '/#organization',
      name: publisher.name,
      url: publisher.url,
      sameAs: sameAs
    },
    {
      '@type': 'WebSite',
      '@id': siteUrl + '/#website',
      url: siteUrl + '/',
      name: brandName,
      description: config.description,
      inLanguage: 'en',
      publisher: { '@id': publisher.url + '/#organization' }
    },
    {
      '@type': 'WebApplication',
      '@id': siteUrl + '/#app',
      name: brandName,
      url: siteUrl + '/',
      description: config.description,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Web browser',
      browserRequirements: 'Requires a modern browser with JavaScript enabled',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      isAccessibleForFree: true,
      featureList: [
        'Text and spreadsheet deduplication',
        'Folder and zip archive cleanup',
        'Image and video near-duplicate detection',
        '100% browser-based, no uploads'
      ],
      screenshot: iconUrl,
      image: iconUrl,
      publisher: { '@id': publisher.url + '/#organization' },
      isPartOf: { '@id': siteUrl + '/#website' },
      sameAs: sameAs
    },
    {
      '@type': 'WebPage',
      '@id': siteUrl + '/#webpage',
      url: siteUrl + '/',
      name: brandName + ' — Remove Duplicates',
      description: config.description,
      isPartOf: { '@id': siteUrl + '/#website' },
      about: { '@id': siteUrl + '/#app' },
      primaryImageOfPage: { '@type': 'ImageObject', url: iconUrl }
    }
  ]
};

const indexPath = path.join(ROOT, 'index.html');
let index = fs.readFileSync(indexPath, 'utf8');
index = index.replace(
  /<title>[^<]*<\/title>/,
  `<title>${brandName} — Remove Duplicates</title>`
);
index = index.replace(
  /<meta name="description" content="[^"]*">/,
  `<meta name="description" content="${escapeHtml(config.description)}">`
);
if (/<meta name="keywords" content="[^"]*">/.test(index)) {
  index = index.replace(
    /<meta name="keywords" content="[^"]*">/,
    `<meta name="keywords" content="${escapeHtml(config.keywords || '')}">`
  );
} else {
  index = index.replace(
    /<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${escapeHtml(config.description)}">\n  <meta name="keywords" content="${escapeHtml(config.keywords || '')}">`
  );
}
index = index.replace(
  /<meta name="robots" content="[^"]*">/,
  `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">`
);
index = index.replace(
  /<meta name="application-name" content="[^"]*">/,
  `<meta name="application-name" content="${escapeHtml(brandName)}">`
);
if (!/<meta name="author" content=/.test(index)) {
  index = index.replace(
    /<meta name="application-name" content="[^"]*">/,
    `<meta name="application-name" content="${escapeHtml(brandName)}">\n  <meta name="author" content="${escapeHtml(publisher.name)}">`
  );
}
index = index.replace(
  /<link rel="canonical" href="[^"]*">/,
  `<link rel="canonical" href="${siteUrl}/">`
);
index = index.replace(
  /<meta property="og:site_name" content="[^"]*">/,
  `<meta property="og:site_name" content="${escapeHtml(brandName)}">`
);
index = index.replace(
  /<meta property="og:title" content="[^"]*">/,
  `<meta property="og:title" content="${escapeHtml(brandName)} — Remove Duplicates">`
);
index = index.replace(
  /<meta property="og:description" content="[^"]*">/,
  `<meta property="og:description" content="${escapeHtml(config.description)}">`
);
index = index.replace(
  /<meta property="og:url" content="[^"]*">/,
  `<meta property="og:url" content="${siteUrl}/">`
);
index = index.replace(
  /<meta property="og:image" content="[^"]*">/,
  `<meta property="og:image" content="${iconUrl}">\n  <meta property="og:image:width" content="${ogImageWidth}">\n  <meta property="og:image:height" content="${ogImageHeight}">\n  <meta property="og:image:alt" content="${escapeHtml(brandName)} icon">\n  <meta property="og:locale" content="${escapeHtml(locale)}">`
);
index = index.replace(
  /<meta name="twitter:card" content="[^"]*">/,
  `<meta name="twitter:card" content="summary_large_image">`
);
index = index.replace(
  /<meta name="twitter:title" content="[^"]*">/,
  `<meta name="twitter:title" content="${escapeHtml(brandName)} — Remove Duplicates">`
);
index = index.replace(
  /<meta name="twitter:description" content="[^"]*">/,
  `<meta name="twitter:description" content="${escapeHtml(config.description)}">`
);
index = index.replace(
  /<meta name="twitter:image" content="[^"]*">/,
  `<meta name="twitter:image" content="${iconUrl}">\n  <meta name="twitter:image:alt" content="${escapeHtml(brandName)} icon">`
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

process.stdout.write('site-meta: wrote robots.txt, sitemap.xml, site.webmanifest, _headers, humans.txt, .well-known/security.txt, and ' + LANDING_PAGES.length + ' SEO landing pages\n');
