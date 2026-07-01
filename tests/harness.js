import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.join(__dirname, '..');

/** Mock DOM checkboxes / selects for engine option reads */
export function createMockDocument(checkboxDefaults = {}, selectDefaults = {}) {
  const checkboxes = { ...checkboxDefaults };
  const selects = { ...selectDefaults };
  return {
    getElementById(id) {
      if (id in checkboxes) {
        return { type: 'checkbox', checked: !!checkboxes[id] };
      }
      if (id in selects) {
        return { value: selects[id] };
      }
      return null;
    }
  };
}

/** Load all Geckodupe engines into a sandboxed context */
export function loadEngines(options = {}) {
  const {
    checkboxDefaults = {},
    selectDefaults = {},
    withPapa = false,
    withXlsx = false
  } = options;

  const ctx = {
    window: {},
    document: createMockDocument(checkboxDefaults, selectDefaults),
    module: { exports: {} },
    exports: {},
    console,
    Math,
    Set,
    Promise,
    Papa: withPapa ? createPapaMock() : undefined,
    XLSX: withXlsx ? createXlsxMock() : undefined
  };

  const engineDir = path.join(ROOT, 'js', 'engines');
  for (const name of [
    'options', 'intelligence', 'checkpoint', 'dedup-utils', 'core',
    'csv', 'json', 'log', 'code', 'todo', 'comparison-keys', 'verify',
    'excel', 'folder', 'media', 'pipeline'
  ]) {
    const src = fs.readFileSync(path.join(engineDir, `${name}.js`), 'utf8');
    vm.runInNewContext(src, ctx);
  }

  return ctx;
}

function createPapaMock() {
  return {
    parse(txt, opts) {
      const rows = txt.split('\n').map((line) => {
        if (!line.trim()) return [''];
        return line.split(',');
      });
      return { data: rows, errors: [] };
    },
    unparse(rows) {
      return rows.map((r) => r.join(',')).join('\n');
    }
  };
}

function createXlsxMock() {
  return {
    read() {
      return { SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } };
    },
    utils: {
      sheet_to_csv() {
        return 'name,value\nalice,1\nbob,2\nalice,1';
      },
      csv_to_sheet(csv) {
        return { csv };
      },
      book_new() {
        return { SheetNames: [], Sheets: {} };
      },
      book_append_sheet(wb, ws, name) {
        wb.SheetNames.push(name);
        wb.Sheets[name] = ws;
      }
    },
    write() {
      return new Uint8Array([1, 2, 3]);
    }
  };
}

export const defaultLineOpts = {
  doStack: false,
  doCaps: false,
  doBlanks: false,
  sortOrder: 'original',
  filterMode: 'all',
  ignorePunct: false,
  collapseWs: false,
  simThreshold: 1
};

/** Spread line opts in the order expected by process* engine functions */
export function lineArgs(opts = defaultLineOpts) {
  return [
    opts.doStack,
    opts.doCaps,
    opts.doBlanks,
    opts.sortOrder,
    opts.simThreshold,
    opts.filterMode,
    opts.ignorePunct,
    opts.collapseWs
  ];
}
