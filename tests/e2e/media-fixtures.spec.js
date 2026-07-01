import { test, expect } from '@playwright/test';

test('fjord photo and snow art are not near-duplicates at 92%', async ({ page }) => {
  await page.goto('/');

  const result = await page.evaluate(async () => {
    async function loadBuffer(url) {
      const r = await fetch(url);
      if (!r.ok) throw new Error('Could not load ' + url);
      return r.arrayBuffer();
    }

    const bufA = await loadBuffer('/tests/fixtures/landscape-photo.png');
    const bufB = await loadBuffer('/tests/fixtures/snow-art.png');
    const sigA = await analyzeImageBuffer(bufA, 'landscape-photo.png');
    const sigB = await analyzeImageBuffer(bufB, 'snow-art.png');

    if (sigA.error || sigB.error) {
      return { error: sigA.error || sigB.error };
    }

    const options = { similarity: 92, allowResize: true };
    const maxH = maxHammingFromSimilarity(92);
    const score = mediaSimilarityScore(sigA, sigB, options);
    const similar = mediaSignaturesSimilar(sigA, sigB, maxH, options);
    const analyzed = [
      { path: 'landscape-photo.png', binaryData: bufA, sig: sigA },
      { path: 'snow-art.png', binaryData: bufB, sig: sigB }
    ];
    const deduped = processMediaAnalysisResults([], analyzed, {
      similarity: 92,
      collapseBursts: false,
      keepLargest: true,
      allowResize: true
    });

    return {
      score: Math.round(score * 1000) / 10,
      similar: similar,
      filesRemoved: deduped.stats.filesRemoved
    };
  });

  expect(result.error).toBeUndefined();
  expect(result.similar).toBe(false);
  expect(result.score).toBeLessThan(85);
  expect(result.filesRemoved).toBe(0);
});

test('landscape target mode removes identical copy but keeps snow art', async ({ page }) => {
  await page.goto('/');

  const result = await page.evaluate(async () => {
    async function loadBuffer(url) {
      const r = await fetch(url);
      if (!r.ok) throw new Error('Could not load ' + url);
      return r.arrayBuffer();
    }

    const landscape = await loadBuffer('/tests/fixtures/landscape-photo.png');
    const snow = await loadBuffer('/tests/fixtures/snow-art.png');
    const sigLandscape = await analyzeImageBuffer(landscape, 'target.jpg');
    const sigSnow = await analyzeImageBuffer(snow, 'other.jpg');
    const sigCopy = await analyzeImageBuffer(landscape, 'copy.jpg');

    const analyzed = [
      { path: 'target.jpg', binaryData: landscape, sig: sigLandscape },
      { path: 'copy.jpg', binaryData: landscape, sig: sigCopy },
      { path: 'other.jpg', binaryData: snow, sig: sigSnow }
    ];

    const deduped = processMediaAnalysisResults([], analyzed, {
      similarity: 92,
      useTargetReference: true,
      targetPath: 'target.jpg',
      targetSig: sigLandscape,
      targetBinary: landscape,
      allowResize: true
    });

    return {
      removed: deduped.stats.filesRemoved,
      kept: deduped.files.map((f) => f.path).sort(),
      targetMode: deduped.stats.targetMode
    };
  });

  expect(result.targetMode).toBe(true);
  expect(result.removed).toBe(1);
  expect(result.kept).toEqual(['other.jpg', 'target.jpg']);
});

test('media preview modal shows duplicate groups', async ({ page }) => {
  await page.goto('/#image-video');

  const ready = await page.evaluate(async () => {
    async function loadBuffer(url) {
      const r = await fetch(url);
      if (!r.ok) throw new Error('Could not load ' + url);
      return r.arrayBuffer();
    }

    const buf = await loadBuffer('/tests/fixtures/landscape-photo.png');
    const sig = await analyzeImageBuffer(buf, 'dup/a.jpg');
    if (sig.error) return { error: sig.error };

    mediaProcessedResult = {
      stats: { filesRemoved: 1 },
      allFiles: [
        { path: 'dup/a.jpg', binaryData: buf, sig: sig },
        { path: 'dup/b.jpg', binaryData: buf, sig: sig }
      ],
      previewGroups: [{
        type: 'variation',
        kept: [{ path: 'dup/a.jpg', kind: 'image', binaryData: buf }],
        removed: [{ path: 'dup/b.jpg', kind: 'image', binaryData: buf }]
      }]
    };
    if (typeof updateMediaPreviewButton === 'function') updateMediaPreviewButton();
    return { groups: mediaProcessedResult.previewGroups.length };
  });

  expect(ready.error).toBeUndefined();
  expect(ready.groups).toBeGreaterThan(0);

  await page.evaluate(() => {
    var container = document.getElementById('media-output-container');
    if (container) container.style.display = 'block';
    document.getElementById('media-preview-open').click();
  });
  await expect(page.locator('#media-preview-modal')).not.toHaveAttribute('hidden', '');
  await expect(page.locator('.media-preview-group h3').first()).toBeVisible();
  await expect(page.locator('.media-preview-card-label').first()).toBeVisible();
});
