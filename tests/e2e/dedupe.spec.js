import { test, expect } from '@playwright/test';

async function dedupe(page, input, options = {}) {
  await page.goto('/');
  await page.waitForFunction(() => typeof processLines === 'function');

  if (options.uncheckStack) {
    await page.locator('#stack').uncheck();
  }
  if (options.checkCaps) {
    await page.locator('#caps').check();
  }
  if (options.similarity !== undefined) {
    await page.locator('#similarity').fill(String(options.similarity));
    await page.evaluate(() => updateSimValue());
  }
  if (options.filterMode) {
    await page.selectOption('#filter-mode', options.filterMode);
  }
  if (options.sortOrder) {
    await page.selectOption('#sort-order', options.sortOrder);
  }

  await page.locator('#masterlist').fill(input);
  await page.getByRole('button', { name: 'Deduplicate' }).click();
  await page.waitForFunction(() => {
    const out = document.getElementById('output');
    return out && out.value.length > 0;
  });
  return page.locator('#output').inputValue();
}

async function getEngineResult(page, mode, input) {
  return page.evaluate(({ mode, input }) => {
    const prev = currentFormatMode;
    currentFormatMode = mode;
    const opts = getGlobalOptions();
    const r = processLines(
      input,
      opts.doStack,
      opts.doCaps,
      opts.doBlanks,
      opts.sortOrder,
      opts.simThreshold,
      opts.filterMode,
      opts.ignorePunct,
      opts.collapseWs
    );
    currentFormatMode = prev;
    return r;
  }, { mode, input });
}

test.describe('Geckodupe engine e2e', () => {
  test('deduplicates plain text via UI', async ({ page }) => {
    const output = await dedupe(page, 'alpha\nbeta\nbeta\nalpha', { uncheckStack: true });
    expect(output.split('\n').sort()).toEqual(['alpha', 'beta']);
  });

  test('stacks duplicates by default', async ({ page }) => {
    const output = await dedupe(page, 'alpha\nbeta\nbeta');
    expect(output).toContain('x2 beta');
  });

  test('live example updates on option change', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => {
      const el = document.getElementById('example-output');
      return el && (el.value || el.innerText || '').trim().length > 0;
    });
    const beforeLines = await page.locator('#example-output').inputValue();
    await page.locator('#caps').check();
    await page.evaluate(() => updateLiveExample());
    const afterLines = await page.locator('#example-output').inputValue();
    expect(afterLines).not.toBe(beforeLines);
  });

  test('auto-detects CSV content', async ({ page }) => {
    await page.goto('/');
    const csv = 'name,age,city\nalice,30,nyc\nbob,25,la\nalice,30,nyc';
    await page.locator('#masterlist').fill(csv);
    await page.waitForFunction(() => currentFormatMode === 'csv');
    const result = await getEngineResult(page, 'csv', csv);
    expect(result.remaining).toBeLessThan(result.total);
    expect(result.lines[0]).toContain('name');
  });

  test('auto-detects JSON content', async ({ page }) => {
    await page.goto('/');
    const json = '[{"a":1},{"a":1},{"b":2}]';
    await page.locator('#masterlist').fill(json);
    await page.waitForFunction(() => currentFormatMode === 'json');
    const result = await getEngineResult(page, 'json', json);
    expect(result.remaining).toBe(2);
  });

  test('auto-detects log content', async ({ page }) => {
    await page.goto('/');
    const log = '[2024-01-01 10:00:00] INFO started\n[2024-01-02 11:00:00] INFO started';
    await page.locator('#masterlist').fill(log);
    await page.waitForFunction(() => currentFormatMode === 'log');
    const result = await getEngineResult(page, 'log', log);
    expect(result.remaining).toBe(1);
  });

  test('auto-detects todo content', async ({ page }) => {
    await page.goto('/');
    const todo = '[ ] Buy milk\n[x] Buy milk';
    await page.locator('#masterlist').fill(todo);
    await page.waitForFunction(() => currentFormatMode === 'todo');
    const result = await getEngineResult(page, 'todo', todo);
    expect(result.remaining).toBe(1);
  });

  test('auto-detects code content', async ({ page }) => {
    await page.goto('/');
    const code = 'import os\nimport sys\n\ndef main():\n    pass';
    await page.locator('#masterlist').fill(code);
    await page.waitForFunction(() => currentFormatMode === 'code');
    const result = await getEngineResult(page, 'code', 'const x = 1;\nconst x = 1; // dup');
    expect(result.remaining).toBe(1);
  });

  test('fuzzy match groups similar lines', async ({ page }) => {
    const output = await dedupe(
      page,
      'the quick brown fox\na quick brown fox runs',
      { uncheckStack: true, similarity: 50 }
    );
    expect(output.split('\n').length).toBe(1);
  });

  test('status shows correct stats after dedupe', async ({ page }) => {
    await page.goto('/');
    await page.locator('#masterlist').fill('a\nb\na');
    await page.getByRole('button', { name: 'Deduplicate' }).click();
    await expect(page.locator('#status-text')).toContainText('Total Input: 3');
    await expect(page.locator('#status-text')).toContainText('Removed Duplicates: 1');
  });

  test('folder engine is exposed and processes project', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(() => {
      const files = [
        { path: 'a.txt', content: 'line1\nline2\nline1' },
        { path: 'b.txt', content: 'line2\nline3' }
      ];
      const scope = {
        dedupFiles: false,
        dedupWithinFiles: true,
        dedupWithinCode: false,
        crossFileLines: true,
        detectCodeBlocks: false,
        removeCodeBlocks: false,
        preserveEntryPoints: true,
        ignoreNodeModules: true,
        ignoreGit: true,
        ignoreDist: true,
        ignoreVendor: true,
        canonicalStrategy: 'shortest',
        reportOnly: false
      };
      const opts = getGlobalOptions();
      return processFolderProject(files, scope, {
        doStack: opts.doStack,
        doCaps: opts.doCaps,
        doBlanks: opts.doBlanks,
        sortOrder: opts.sortOrder,
        simThreshold: opts.simThreshold,
        filterMode: opts.filterMode,
        ignorePunct: opts.ignorePunct,
        collapseWs: opts.collapseWs
      });
    });
    expect(result.stats.linesRemoved).toBeGreaterThan(0);
  });

  test('folder manual skip UI wires into scope options', async ({ page }) => {
    await page.goto('/');
    await page.locator('#t-4').click();
    await page.locator('#folder-manual-skips').fill('private\n*.bak');
    await page.locator('#folder-skip-dist').uncheck();
    const scope = await page.evaluate(() => getFolderScopeOptions());
    expect(scope.manualSkips).toEqual(['private', '*.bak']);
    expect(scope.ignoreDist).toBe(false);
    expect(scope.manualSkipsCompiled).toBeTruthy();
  });

  test('media tab exposes engine and processes demo signatures', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(() => {
      var hash = bitsToHex('1111000011110000111100001111000011110000111100001111000011110000');
      var analyzed = [
        {
          path: 'a.jpg',
          binaryData: new ArrayBuffer(4),
          sig: { kind: 'image', dHash: hash, aHash: hash, scales: [hash], exactHash: 'a', width: 100, height: 100, byteSize: 100 }
        },
        {
          path: 'b.jpg',
          binaryData: new ArrayBuffer(4),
          sig: { kind: 'image', dHash: hash, aHash: hash, scales: [hash], exactHash: 'b', width: 100, height: 100, byteSize: 100 }
        }
      ];
      return processMediaAnalysisResults([], analyzed, {
        similarity: 92,
        collapseBursts: false,
        keepLargest: true,
        allowResize: true
      });
    });
    expect(result.stats.filesRemoved).toBeGreaterThan(0);
    expect(result.stats.keptFiles).toBe(1);
  });

  test('media skip UI and demo update on tab', async ({ page }) => {
    await page.goto('/');
    await page.locator('#t-5').click();
    await page.locator('#media-manual-skips').fill('exports');
    const scope = await page.evaluate(() => getMediaScopeOptions());
    expect(scope.manualSkips).toEqual(['exports']);
    await page.locator('#media-similarity').fill('95');
    await expect(page.locator('#media-example-status')).toContainText('Kept:');
  });

  test('media target checkbox without pick does not attach target options', async ({ page }) => {
    await page.goto('/');
    await page.locator('#t-5').click();
    await page.locator('#media-use-target').check();
    const opts = await page.evaluate(() => getMediaProcessOptions());
    expect(opts.useTargetReference).toBeFalsy();
  });

  test('clear resets workspace', async ({ page }) => {
    await page.goto('/');
    await page.locator('#masterlist').fill('test data');
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(page.locator('#masterlist')).toHaveValue('');
  });

  test('info page groups supported file types by tab', async ({ page }) => {
    await page.goto('/');
    await page.locator('#t-3').click();
    await page.waitForFunction(() => document.getElementById('s-3')?.classList.contains('current'));
    const blocks = page.locator('.info-math-block');
    await expect(blocks).toHaveCount(3);
    await expect(blocks.nth(0).locator('h3')).toHaveText('Text / File');
    await expect(blocks.nth(1).locator('h3')).toHaveText('Folder / Zip');
    await expect(blocks.nth(2).locator('h3')).toHaveText('Img / Vid');
    await expect(page.locator('.info-media-note')).toContainText('reference-target');
    const folderNote = page.locator('.info-folder-note:not(.info-media-note)');
    await expect(folderNote).toContainText('node_modules');
    await expect(folderNote).toContainText('skip');
  });
});
