#!/usr/bin/env node
const { spawn, spawnSync } = require('child_process');
const http = require('http');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 4173;
const URL = `http://127.0.0.1:${PORT}/`;
const OUT = path.join(ROOT, 'lighthouse-report.json');

function waitForServer() {
  return new Promise((resolve, reject) => {
    let tries = 0;
    const tick = () => {
      const req = http.get(URL, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (++tries > 40) reject(new Error('Server did not start'));
        else setTimeout(tick, 250);
      });
    };
    tick();
  });
}

function runLighthouse() {
  return new Promise((resolve, reject) => {
    const args = [
      'lighthouse', URL,
      '--output=json',
      `--output-path=${OUT}`,
      '--chrome-flags=--headless',
      '--only-categories=performance,accessibility,best-practices,seo'
    ];
    const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
      cwd: ROOT,
      stdio: 'inherit',
      shell: true
    });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('Lighthouse failed'))));
  });
}

function printScores() {
  const report = require(OUT);
  console.log('\nLighthouse scores:');
  for (const [name, cat] of Object.entries(report.categories)) {
    console.log(`  ${name}: ${Math.round(cat.score * 100)}`);
  }
  console.log('\nRemaining audits below 100:');
  for (const a of Object.values(report.audits)) {
    if (a.score !== null && a.score < 1 && a.scoreDisplayMode !== 'informative' && a.scoreDisplayMode !== 'notApplicable') {
      console.log(`  - ${a.id}: ${Math.round(a.score * 100)}`);
    }
  }
}

async function main() {
  spawnSync('node', [path.join(__dirname, 'build.js')], { cwd: ROOT, stdio: 'inherit' });

  const server = spawn('node', [path.join(__dirname, 'serve.js')], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), USE_MINIFIED: '1' },
    stdio: ['ignore', 'pipe', 'inherit']
  });

  server.on('error', (err) => {
    if (err.code !== 'EADDRINUSE') console.error(err);
  });

  try {
    await waitForServer();
    await runLighthouse();
    printScores();
  } finally {
    server.kill();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
