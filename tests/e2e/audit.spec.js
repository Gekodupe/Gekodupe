import { test, expect } from '@playwright/test';

test.describe('Golden audit e2e', () => {
  test('dedup completes under 5s for 5k lines', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof processLines === 'function');

    const lines = Array.from({ length: 5000 }, (_, i) => `row-${i % 1200} data`);
    const input = lines.join('\n');

    const elapsed = await page.evaluate(async (text) => {
      const opts = getGlobalOptions();
      const start = performance.now();
      const r = processLines(
        text,
        opts.doStack,
        opts.doCaps,
        opts.doBlanks,
        opts.sortOrder,
        opts.simThreshold,
        opts.filterMode,
        opts.ignorePunct,
        opts.collapseWs,
        'full'
      );
      return { ms: Math.round(performance.now() - start), remaining: r.remaining, total: r.total };
    }, input);

    expect(elapsed.ms).toBeLessThan(5000);
    expect(elapsed.remaining).toBeLessThan(elapsed.total);
  });

  test('live preview uses fast path (no checkpoint flood)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof updateLiveExample === 'function');

    const checkpointsBefore = await page.evaluate(() =>
      typeof listCheckpoints === 'function' ? listCheckpoints().length : 0
    );

    await page.evaluate(() => {
      for (let i = 0; i < 5; i++) updateLiveExample();
    });

    const checkpointsAfter = await page.evaluate(() =>
      typeof listCheckpoints === 'function' ? listCheckpoints().length : 0
    );

    expect(checkpointsAfter).toBe(checkpointsBefore);
  });

  test('full dedup creates checkpoint and passes verification', async ({ page }) => {
    await page.goto('/');
    await page.locator('#masterlist').fill('alpha\nbeta\nalpha\ngamma\nbeta');
    await page.getByRole('button', { name: 'Deduplicate' }).click();
    await page.waitForFunction(() => {
      const out = document.getElementById('output');
      return out && out.value.length > 0;
    });

    const diag = await page.evaluate(() => {
      const run = window.lastPipelineRun;
      return run ? {
        verified: run.verification && run.verification.passed,
        remaining: run.result.remaining,
        canRevert: run.canRevert,
        hasCheckpoint: !!run.checkpointId
      } : null;
    });

    expect(diag).not.toBeNull();
    expect(diag.verified).toBe(true);
    expect(diag.remaining).toBe(3);
    expect(diag.canRevert).toBe(true);
    expect(diag.hasCheckpoint).toBe(true);
  });

  test('batch formats succeed via engine API', async ({ page }) => {
    await page.goto('/');
    const results = await page.evaluate(() => {
      const opts = {
        doStack: false, doCaps: false, doBlanks: false,
        sortOrder: 'original', simThreshold: 1, filterMode: 'all',
        ignorePunct: false, collapseWs: false
      };
      const cases = [
        { mode: 'txt', text: 'a\nb\na' },
        { mode: 'json', text: '[{"x":1},{"x":1},{"y":2}]' },
        { mode: 'log', text: '[2024-01-01] INFO hi\n[2024-01-02] INFO hi' },
        { mode: 'todo', text: '[ ] task\n[x] task' },
        { mode: 'code', text: 'const a = 1;\nconst a = 1;' }
      ];
      return cases.map((c) => {
        const run = runTextPipeline(c.text, { ...opts, mode: c.mode, fast: false, sniff: false });
        return { mode: c.mode, ok: run.verification.passed && run.result.remaining > 0 };
      });
    });

    results.forEach((r) => expect(r.ok, `format ${r.mode} failed`).toBe(true));
  });
});
