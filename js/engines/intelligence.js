var GECKO_CODE_EXTENSIONS = [
  '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.py', '.pyw', '.pyi',
  '.java', '.kt', '.kts', '.scala', '.sc', '.groovy', '.gradle',
  '.cpp', '.cc', '.cxx', '.c', '.h', '.hpp', '.hxx', '.cs', '.fs', '.fsx', '.vb',
  '.go', '.rs', '.rb', '.php', '.swift', '.m', '.mm',
  '.r', '.jl', '.lua', '.pl', '.pm', '.sh', '.bash', '.zsh', '.fish',
  '.ps1', '.psm1', '.bat', '.cmd',
  '.css', '.scss', '.sass', '.less', '.styl',
  '.html', '.htm', '.xhtml', '.vue', '.svelte', '.astro',
  '.elm', '.clj', '.cljs', '.ex', '.exs', '.erl', '.hrl', '.hs', '.lhs',
  '.dart', '.zig', '.nim', '.v', '.vh', '.sv', '.tcl', '.awk',
  '.sql', '.graphql', '.gql', '.proto', '.tf', '.hcl', '.sol', '.move'
];

var GECKO_DATA_EXTENSIONS = {
  csv: ['.csv', '.tsv', '.psv', '.ssv', '.tab'],
  json: ['.json', '.jsonl', '.ndjson', '.geojson', '.yaml', '.yml', '.xml', '.toml'],
  log: ['.log', '.sql', '.audit', '.trace', '.out', '.err'],
  todo: ['.todo', '.list', '.task', '.tasks', '.checklist'],
  excel: ['.xlsx', '.xls', '.xlsm', '.ods'],
  txt: ['.txt', '.text', '.md', '.markdown', '.rst', '.adoc', '.org', '.rtf', '.ini', '.cfg', '.conf', '.properties', '.env', '.env.local', '.gitignore', '.dockerignore', '.editorconfig', '.prettierrc', '.eslintrc']
};

var GECKO_SKIP_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.svg',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.mp3', '.mp4', '.wav', '.avi', '.mov', '.webm',
  '.pdf', '.exe', '.dll', '.so', '.dylib', '.bin', '.dat',
  '.zip', '.gz', '.tar', '.7z', '.rar', '.bz2', '.xz', '.wasm', '.map',
  '.class', '.jar', '.pyc', '.pyo', '.o', '.a', '.lib'
];

var GECKO_LANGUAGE_PROFILES = {
  javascript: {
    extensions: ['.js', '.mjs', '.cjs', '.jsx'],
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    importPatterns: [/^\s*(?:import|export|require)\b/],
    keywords: [/\bfunction\b/, /\bconst\b/, /\blet\b/, /\bvar\b/, /\bclass\b/]
  },
  typescript: {
    extensions: ['.ts', '.tsx'],
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    importPatterns: [/^\s*(?:import|export)\b/, /:\s*\w+(\[\])?(\s*[;,=]|$)/],
    keywords: [/\binterface\b/, /\btype\b/, /\benum\b/]
  },
  python: {
    extensions: ['.py', '.pyw', '.pyi'],
    lineComments: ['#'],
    blockComments: [['"""', '"""'], ["'''", "'''"]],
    importPatterns: [/^\s*(?:import|from)\s+\w+/],
    keywords: [/\bdef\b/, /\bclass\b/, /\bself\b/, /\belif\b/]
  },
  ruby: {
    extensions: ['.rb'],
    lineComments: ['#'],
    blockComments: [['=begin', '=end']],
    importPatterns: [/^\s*(?:require|include)\b/],
    keywords: [/\bdef\b/, /\bend\b/, /\bmodule\b/]
  },
  go: {
    extensions: ['.go'],
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    importPatterns: [/^\s*import\s+\(/, /^\s*import\s+"/],
    keywords: [/\bfunc\b/, /\bpackage\b/, /\bgo\b/]
  },
  rust: {
    extensions: ['.rs'],
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    importPatterns: [/^\s*(?:use|mod|extern\s+crate)\b/],
    keywords: [/\bfn\b/, /\blet\b/, /\bmut\b/, /\bimpl\b/]
  },
  java: {
    extensions: ['.java', '.kt', '.kts', '.scala', '.sc', '.groovy'],
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    importPatterns: [/^\s*import\s+[\w.]+/],
    keywords: [/\bpublic\b/, /\bclass\b/, /\bvoid\b/, /\bfun\b/]
  },
  csharp: {
    extensions: ['.cs', '.fs', '.fsx', '.vb'],
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    importPatterns: [/^\s*using\s+[\w.]+/],
    keywords: [/\bnamespace\b/, /\bclass\b/]
  },
  php: {
    extensions: ['.php'],
    lineComments: ['//', '#'],
    blockComments: [['/*', '*/']],
    importPatterns: [/^\s*(?:use|require|include)\b/],
    keywords: [/\bfunction\b/, /\bnamespace\b/, /<\?php/]
  },
  shell: {
    extensions: ['.sh', '.bash', '.zsh', '.fish'],
    lineComments: ['#'],
    blockComments: [],
    importPatterns: [/^\s*source\s+/],
    keywords: [/\bfi\b/, /\bdone\b/, /\besac\b/]
  },
  powershell: {
    extensions: ['.ps1', '.psm1'],
    lineComments: ['#'],
    blockComments: [['<#', '#>']],
    importPatterns: [/^\s*(?:Import-Module|using\s+namespace)\b/i],
    keywords: [/\$\w+/, /-\w+\s/]
  },
  sql: {
    extensions: ['.sql'],
    lineComments: ['--'],
    blockComments: [['/*', '*/']],
    importPatterns: [],
    keywords: [/\bSELECT\b/i, /\bINSERT\b/i, /\bCREATE\s+TABLE\b/i, /\bVALUES\s*\(/i]
  },
  html: {
    extensions: ['.html', '.htm', '.xhtml', '.vue', '.svelte', '.astro'],
    lineComments: [],
    blockComments: [['<!--', '-->']],
    importPatterns: [],
    keywords: [/<[a-zA-Z][^>]*>/, /<\/\w+>/]
  },
  css: {
    extensions: ['.css', '.scss', '.sass', '.less', '.styl'],
    lineComments: [],
    blockComments: [['/*', '*/']],
    importPatterns: [/@import\b/],
    keywords: [/\{[^}]*:[^}]*\}/, /@media\b/]
  },
  lua: {
    extensions: ['.lua'],
    lineComments: ['--'],
    blockComments: [['--[[', ']]']],
    importPatterns: [/^\s*(?:require|local)\b/],
    keywords: [/\bfunction\b/, /\bend\b/, /\blocal\b/]
  },
  r: {
    extensions: ['.r', '.R'],
    lineComments: ['#'],
    blockComments: [],
    importPatterns: [/^\s*(?:library|require)\s*\(/],
    keywords: [/<-/, /\bfunction\s*\(/]
  },
  swift: {
    extensions: ['.swift'],
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    importPatterns: [/^\s*import\s+\w+/],
    keywords: [/\bfunc\b/, /\bvar\b/, /\blet\b/]
  },
  dart: {
    extensions: ['.dart'],
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    importPatterns: [/^\s*import\s+'/],
    keywords: [/\bvoid\b/, /\bclass\b/]
  },
  generic: {
    extensions: [],
    lineComments: ['//', '#', '--'],
    blockComments: [['/*', '*/'], ['<!--', '-->']],
    importPatterns: [/^\s*(?:import|from|require|use|#include)\b/i],
    keywords: []
  }
};

var GECKO_CONTENT_SIGNALS = [
  { mode: 'log', weight: 12, re: /\[\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/ },
  { mode: 'log', weight: 10, re: /\b(?:INFO|WARN|ERROR|DEBUG|TRACE|FATAL)\b.*\b(?:pid|req|trace)=/i },
  { mode: 'log', weight: 9, re: /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/m },
  { mode: 'log', weight: 8, re: /\b(?:nginx|apache|syslog)\b/i },
  { mode: 'log', weight: 8, re: /\bVALUES\s*\(/i },
  { mode: 'json', weight: 11, re: /^\s*[\[{][\s\S]*[\]}]\s*$/m },
  { mode: 'json', weight: 9, re: /^\s*\{[^}]+\}\s*$/m },
  { mode: 'json', weight: 7, re: /^\s*[\w.-]+:\s*.+$/m },
  { mode: 'todo', weight: 10, re: /^\s*(?:[\*\-\+]|\d+\.)?\s*\[[ xX_/]\]/m },
  { mode: 'todo', weight: 9, re: /^\s*(?:TODO|DONE|WAITING|COMPLETED|PENDING):/im },
  { mode: 'csv', weight: 8, re: /^[^,\n]+,[^,\n]+,[^,\n]+/m },
  { mode: 'csv', weight: 7, re: /^[^\t\n]+\t[^\t\n]+\t/m },
  { mode: 'code', weight: 8, re: /^\s*(?:import|from|require|use|#include|package|namespace)\s+/m },
  { mode: 'code', weight: 7, re: /^\s*(?:def|function|func|fn|class|interface|struct)\s+\w+/m },
  { mode: 'code', weight: 6, re: /^\s*(?:\/\/|#|--)\s+/m },
  { mode: 'txt', weight: 3, re: /^\s*(?:[\*\-\+]|\d+\.)\s+\S/m }
];

function extOf(path) {
  if (!path) return '';
  var base = path.split('/').pop().split('\\').pop().toLowerCase();
  var dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  return base.slice(dot);
}

function basenameLower(path) {
  if (!path) return '';
  return path.split('/').pop().split('\\').pop().toLowerCase();
}

function scoreExtension(path) {
  var ext = extOf(path);
  var base = basenameLower(path);
  var scores = { txt: 1 };

  if (!ext) {
    if (base === 'dockerfile' || base.startsWith('dockerfile.')) scores.code = 15;
    if (base === 'makefile' || base === 'gnumakefile') scores.code = 15;
    if (base === 'rakefile' || base === 'gemfile' || base === 'podfile') scores.code = 12;
    if (base === '.env' || base.endsWith('.env')) scores.txt = 8;
    return scores;
  }

  if (GECKO_SKIP_EXTENSIONS.indexOf(ext) !== -1) return { skip: 100 };

  var mode;
  for (mode in GECKO_DATA_EXTENSIONS) {
    if (GECKO_DATA_EXTENSIONS[mode].indexOf(ext) !== -1) {
      scores[mode] = (scores[mode] || 0) + 20;
    }
  }
  if (GECKO_CODE_EXTENSIONS.indexOf(ext) !== -1) scores.code = (scores.code || 0) + 18;

  if (ext === '.tsv' || ext === '.tab') scores.csv = (scores.csv || 0) + 5;
  if (ext === '.ndjson' || ext === '.jsonl') scores.json = (scores.json || 0) + 5;
  if (ext === '.md' || ext === '.markdown') scores.txt = (scores.txt || 0) + 8;
  if (base.indexOf('todo') !== -1 || base.indexOf('shopping') !== -1) scores.todo = (scores.todo || 0) + 6;

  return scores;
}

function scoreContent(content) {
  var scores = {};
  if (!content || !content.trim()) return scores;
  var sample = content.slice(0, 16000);
  var lines = sample.split('\n').slice(0, 40);

  GECKO_CONTENT_SIGNALS.forEach(function(sig) {
    if (sig.re.test(sample)) scores[sig.mode] = (scores[sig.mode] || 0) + sig.weight;
  });

  var commaRows = 0;
  var tabRows = 0;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (!line.trim()) continue;
    if (line.indexOf(',') !== -1 && line.split(',').length >= 3) commaRows++;
    if (line.indexOf('\t') !== -1 && line.split('\t').length >= 3) tabRows++;
  }
  if (commaRows >= 2 && commaRows >= lines.length * 0.4) scores.csv = (scores.csv || 0) + 10;
  if (tabRows >= 2 && tabRows >= lines.length * 0.4) scores.csv = (scores.csv || 0) + 10;

  try {
    var t = sample.trim();
    if ((t.startsWith('[') && t.endsWith(']')) || (t.startsWith('{') && t.endsWith('}'))) {
      JSON.parse(t);
      scores.json = (scores.json || 0) + 15;
    }
  } catch (e) {}

  var jsonl = 0;
  for (var j = 0; j < Math.min(lines.length, 20); j++) {
    var ln = lines[j].trim();
    if (!ln) continue;
    try { JSON.parse(ln); jsonl++; } catch (e2) {}
  }
  if (jsonl >= 2) scores.json = (scores.json || 0) + 12;

  return scores;
}

function pickTopScore(scores) {
  var best = 'txt';
  var bestVal = -1;
  Object.keys(scores).forEach(function(k) {
    if (k === 'skip') return;
    if (scores[k] > bestVal) {
      bestVal = scores[k];
      best = k;
    }
  });
  return { mode: best, confidence: Math.min(1, bestVal / 25) };
}

function sniffFormat(path, content) {
  var extScores = scoreExtension(path || '');
  if (extScores.skip) return { mode: 'skip', confidence: 1, source: 'extension' };

  var contentScores = scoreContent(content || '');
  var merged = {};
  Object.keys(extScores).forEach(function(k) { merged[k] = extScores[k]; });
  Object.keys(contentScores).forEach(function(k) {
    merged[k] = (merged[k] || 0) + contentScores[k];
  });

  var picked = pickTopScore(merged);
  return {
    mode: picked.mode,
    confidence: picked.confidence,
    source: content ? 'path+content' : 'path',
    scores: merged,
    language: detectLanguage(path, content)
  };
}

function detectLanguage(path, content) {
  var ext = extOf(path);
  var lang;
  var best = 'generic';
  var bestScore = 0;

  for (lang in GECKO_LANGUAGE_PROFILES) {
    if (lang === 'generic') continue;
    var profile = GECKO_LANGUAGE_PROFILES[lang];
    var score = 0;
    if (ext && profile.extensions.indexOf(ext) !== -1) score += 25;
    if (content) {
      var sample = content.slice(0, 8000);
      profile.importPatterns.forEach(function(re) { if (re.test(sample)) score += 8; });
      profile.keywords.forEach(function(re) { if (re.test(sample)) score += 4; });
    }
    if (score > bestScore) {
      bestScore = score;
      best = lang;
    }
  }
  return { id: bestScore > 0 ? best : 'generic', confidence: Math.min(1, bestScore / 30), profile: GECKO_LANGUAGE_PROFILES[bestScore > 0 ? best : 'generic'] };
}

function getLanguageProfile(path, content) {
  return detectLanguage(path, content).profile;
}

function getLanguageId(path, content) {
  return detectLanguage(path, content).id;
}

function stripCodeCommentsWithProfile(line, profile) {
  var s = line;
  var p = profile || GECKO_LANGUAGE_PROFILES.generic;
  (p.lineComments || []).forEach(function(marker) {
    var idx = s.indexOf(marker);
    if (idx >= 0) s = s.slice(0, idx);
  });
  if (p.id === 'html' || (p.blockComments && p.blockComments.some(function(b) { return b[0] === '<!--'; }))) {
    s = s.replace(/<!--.*?-->/g, '');
  }
  return s.trim();
}

function isBinaryPath(path) {
  var ext = extOf(path);
  return GECKO_SKIP_EXTENSIONS.indexOf(ext) !== -1;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    sniffFormat: sniffFormat,
    detectLanguage: detectLanguage,
    getLanguageProfile: getLanguageProfile,
    getLanguageId: getLanguageId,
    stripCodeCommentsWithProfile: stripCodeCommentsWithProfile,
    isBinaryPath: isBinaryPath,
    GECKO_CODE_EXTENSIONS: GECKO_CODE_EXTENSIONS,
    GECKO_LANGUAGE_PROFILES: GECKO_LANGUAGE_PROFILES
  };
}
