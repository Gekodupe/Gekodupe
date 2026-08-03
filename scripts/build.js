#!/usr/bin/env node
// Minify CSS and JS for production Lighthouse / deploy bundles.

const fs = require('fs');
const path = require('path');
const { transformSync } = require('esbuild');

const ROOT = path.join(__dirname, '..');

function listJsFiles(dir, out) {
  out = out || [];
  fs.readdirSync(dir).forEach(function (name) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      listJsFiles(full, out);
      return;
    }
    if (name.endsWith('.js') && !name.endsWith('.min.js')) {
      out.push(full);
    }
  });
  return out;
}

function minifyCss(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>+~])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}

function build() {
  const cssPath = path.join(ROOT, 'css', 'style.css');
  const cssMinPath = path.join(ROOT, 'css', 'style.min.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  fs.writeFileSync(cssMinPath, minifyCss(css));

  const jsFiles = listJsFiles(path.join(ROOT, 'js'));
  jsFiles.forEach(function (file) {
    const result = transformSync(fs.readFileSync(file, 'utf8'), {
      loader: 'js',
      minify: true,
      target: 'es2018'
    });
    const minPath = file.replace(/\.js$/, '.min.js');
    fs.writeFileSync(minPath, result.code);
  });

  process.stdout.write('build: wrote css/style.min.css and ' + (jsFiles.length + 1) + ' minified assets\n');
}

build();
