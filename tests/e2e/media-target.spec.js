import { test, expect } from '@playwright/test';
import {
  gotoMediaTab,
  resetMediaWorkspace,
  loadSyntheticMediaProject,
  loadFixtureBuffers,
  setMediaTargetFromPath,
  enableMediaTargetMode,
  runMediaDedupe,
  runMediaEngine,
  makeImageAnalyzed,
  makeVideoAnalyzed
} from './media-helpers.js';

const HASH_A = 'f0f0f0f0f0f0f0f0';
const HASH_B = '0f0f0f0f0f0f0f0f';
const HASH_C = 'cccccccccccccccc';

test.describe('media reference target mode', () => {
  test.beforeEach(async ({ page }) => {
    await gotoMediaTab(page);
    await resetMediaWorkspace(page);
  });

  test('target panel is visible and library dropdown enables after load', async ({ page }) => {
    await expect(page.locator('.media-target-panel')).toBeVisible();
    await expect(page.locator('#media-target-from-library')).toBeDisabled();

    await loadSyntheticMediaProject(page, ['photos/a.jpg', 'photos/b.jpg']);
    await expect(page.locator('#media-target-from-library')).toBeEnabled();
    await expect(page.locator('#media-target-from-library option')).toHaveCount(3);
  });

  test('setMediaTargetFromLibrary checks target mode and updates label', async ({ page }) => {
    await loadSyntheticMediaProject(page, ['roll/keep.jpg', 'roll/dup.jpg']);
    const picked = await setMediaTargetFromPath(page, 'roll/keep.jpg');

    expect(picked.path).toBe('roll/keep.jpg');
    expect(picked.checked).toBe(true);
    await expect(page.locator('#media-target-label')).toContainText('roll/keep.jpg');
    await expect(page.locator('#media-target-clear')).toBeVisible();
  });

  test('clearMediaTarget resets UI state', async ({ page }) => {
    await loadSyntheticMediaProject(page, ['a.jpg']);
    await setMediaTargetFromPath(page, 'a.jpg');
    await page.locator('#media-target-clear').click();

    await expect(page.locator('#media-target-label')).toContainText('No target selected');
    await expect(page.locator('#media-target-clear')).toBeHidden();
    const opts = await page.evaluate(() => getMediaProcessOptions());
    expect(opts.useTargetReference).toBeFalsy();
  });

  test('dedupe warns when target mode is on without a picked target', async ({ page }) => {
    await loadSyntheticMediaProject(page, ['only.jpg']);
    await enableMediaTargetMode(page, true);

    const outcome = await page.evaluate(async () => {
      var toastMsg = '';
      var orig = showToast;
      showToast = function(msg) { toastMsg = msg; };
      await deduplicateMedia();
      showToast = orig;
      return {
        toast: toastMsg,
        hasResult: !!mediaProcessedResult
      };
    });

    expect(outcome.toast).toMatch(/target/i);
    expect(outcome.hasResult).toBe(false);
  });

  test('engine target mode keeps target and removes only its variations', async ({ page }) => {
    const result = await runMediaEngine(page, [
      makeImageAnalyzed('target.jpg', HASH_A, 'target'),
      makeImageAnalyzed('copy1.jpg', HASH_A, 'copy1'),
      makeImageAnalyzed('copy2.jpg', HASH_A, 'copy2'),
      makeImageAnalyzed('other.jpg', HASH_B, 'other')
    ], [], {
      similarity: 92,
      useTargetReference: true,
      targetPath: 'target.jpg',
      targetSig: makeImageAnalyzed('target.jpg', HASH_A, 'target').sig,
      allowResize: true
    });

    expect(result.targetMode).toBe(true);
    expect(result.removed).toBe(2);
    expect(result.keptPaths).toEqual(['other.jpg', 'target.jpg']);
    expect(result.clusters[0].kept).toBe('target.jpg');
    expect(result.previewGroups).toBe(1);
  });

  test('engine target mode does not dedupe among non-target files', async ({ page }) => {
    const result = await runMediaEngine(page, [
      makeImageAnalyzed('target.jpg', HASH_A, 'target'),
      makeImageAnalyzed('target-copy.jpg', HASH_A, 'copy'),
      makeImageAnalyzed('burst1.jpg', HASH_B, 'b1'),
      makeImageAnalyzed('burst2.jpg', HASH_B, 'b2')
    ], [], {
      similarity: 92,
      useTargetReference: true,
      targetPath: 'target.jpg',
      targetSig: makeImageAnalyzed('target.jpg', HASH_A, 'target').sig,
      allowResize: true
    });

    expect(result.removed).toBe(1);
    expect(result.keptPaths).toEqual(['burst1.jpg', 'burst2.jpg', 'target.jpg']);
  });

  test('normal mode still removes duplicates across the whole library', async ({ page }) => {
    const result = await runMediaEngine(page, [
      makeImageAnalyzed('target.jpg', HASH_A, 'target'),
      makeImageAnalyzed('target-copy.jpg', HASH_A, 'copy'),
      makeImageAnalyzed('burst1.jpg', HASH_B, 'b1'),
      makeImageAnalyzed('burst2.jpg', HASH_B, 'b2')
    ], [], {
      similarity: 92,
      collapseBursts: false,
      keepLargest: true,
      allowResize: true
    });

    expect(result.targetMode).toBe(false);
    expect(result.removed).toBeGreaterThanOrEqual(2);
    expect(result.kept).toBeLessThan(4);
  });

  test('target mode keeps passthrough skip files', async ({ page }) => {
    const result = await runMediaEngine(page, [
      makeImageAnalyzed('target.jpg', HASH_A, 'target'),
      makeImageAnalyzed('dup.jpg', HASH_A, 'dup')
    ], [
      { path: 'raw/approved.jpg', binaryData: new ArrayBuffer(4), passthrough: true, skip: true }
    ], {
      similarity: 92,
      useTargetReference: true,
      targetPath: 'target.jpg',
      targetSig: makeImageAnalyzed('target.jpg', HASH_A, 'target').sig,
      allowResize: true
    });

    expect(result.keptPaths).toContain('raw/approved.jpg');
    expect(result.removed).toBe(1);
  });

  test('target mode does not remove videos when target is an image', async ({ page }) => {
    const result = await runMediaEngine(page, [
      makeImageAnalyzed('target.jpg', HASH_A, 'target'),
      makeImageAnalyzed('dup.jpg', HASH_A, 'dup'),
      makeVideoAnalyzed('clip.mp4', HASH_A, 'clip')
    ], [], {
      similarity: 92,
      useTargetReference: true,
      targetPath: 'target.jpg',
      targetSig: makeImageAnalyzed('target.jpg', HASH_A, 'target').sig,
      allowResize: true
    });

    expect(result.removed).toBe(1);
    expect(result.keptPaths).toContain('clip.mp4');
  });

  test('external target is kept in output even when not in analyzed set', async ({ page }) => {
    const external = makeImageAnalyzed('external/ref.jpg', HASH_C, 'ext');
    const result = await runMediaEngine(page, [
      makeImageAnalyzed('library/dup.jpg', HASH_C, 'dup')
    ], [], {
      similarity: 92,
      useTargetReference: true,
      targetPath: 'external/ref.jpg',
      targetSig: external.sig,
      targetBinary: external.binaryData,
      allowResize: true
    });

    expect(result.removed).toBe(1);
    expect(result.keptPaths).toEqual(['external/ref.jpg']);
  });

  test('demo switches to target mode and removes only vacation copy', async ({ page }) => {
    await enableMediaTargetMode(page, true);
    await page.waitForFunction(() => {
      var status = document.getElementById('media-example-status');
      return status && status.textContent.includes('Target mode');
    });

    const demo = await page.evaluate(() => {
      return {
        status: document.getElementById('media-example-status').textContent,
        output: document.getElementById('media-example-output').value
      };
    });

    expect(demo.status).toContain('Target mode');
    expect(demo.output).toContain('vacation_copy.jpg');
    expect(demo.output).not.toContain('IMG_0001');
  });

  test('full UI flow: library target dedupes real fixture duplicates', async ({ page }) => {
    await loadFixtureBuffers(page, [
      { url: '/tests/fixtures/landscape-photo.png', path: 'set/target.jpg' },
      { url: '/tests/fixtures/landscape-photo.png', path: 'set/copy.jpg' },
      { url: '/tests/fixtures/snow-art.png', path: 'set/other.jpg' }
    ]);

    await setMediaTargetFromPath(page, 'set/target.jpg');
    const outcome = await runMediaDedupe(page);

    expect(outcome.result).toBeTruthy();
    expect(outcome.result.targetMode).toBe(true);
    expect(outcome.result.removed).toBe(1);
    expect(outcome.result.keptPaths).toEqual(['set/other.jpg', 'set/target.jpg']);
    await expect(page.locator('#media-status-text')).toContainText('Target:');
  });

  test('full UI flow: unrelated fixtures kept under target mode', async ({ page }) => {
    await loadFixtureBuffers(page, [
      { url: '/tests/fixtures/landscape-photo.png', path: 'a.jpg' },
      { url: '/tests/fixtures/snow-art.png', path: 'b.jpg' }
    ]);

    await setMediaTargetFromPath(page, 'a.jpg');
    const outcome = await runMediaDedupe(page);

    expect(outcome.result.removed).toBe(0);
    expect(outcome.result.keptPaths).toEqual(['a.jpg', 'b.jpg']);
  });

  test('clearMediaProject resets target checkbox and reference', async ({ page }) => {
    await loadSyntheticMediaProject(page, ['x.jpg']);
    await setMediaTargetFromPath(page, 'x.jpg');
    await page.locator('#s-5 button[onclick="clearMediaProject()"]').click();

    await expect(page.locator('#media-use-target')).not.toBeChecked();
    await expect(page.locator('#media-target-label')).toContainText('No target selected');
    const ref = await page.evaluate(() => mediaTargetRef);
    expect(ref).toBeNull();
  });

  test('clear target button only clears reference not workspace', async ({ page }) => {
    await loadSyntheticMediaProject(page, ['keep.jpg', 'other.jpg']);
    await setMediaTargetFromPath(page, 'keep.jpg');
    await page.locator('#media-target-clear').click();

    await expect(page.locator('#media-use-target')).not.toBeChecked();
    const count = await page.evaluate(() => mediaProjectFiles.length);
    expect(count).toBe(2);
  });

  test('revert restores library after target-mode dedupe', async ({ page }) => {
    await loadFixtureBuffers(page, [
      { url: '/tests/fixtures/landscape-photo.png', path: 't.jpg' },
      { url: '/tests/fixtures/landscape-photo.png', path: 'dup.jpg' }
    ]);
    await setMediaTargetFromPath(page, 't.jpg');
    const deduped = await runMediaDedupe(page);

    expect(deduped.result.kept).toBe(1);
    const workspaceBefore = await page.evaluate(() => mediaProjectFiles.length);
    expect(workspaceBefore).toBe(2);

    const reverted = await page.evaluate(() => revertMediaProject());
    expect(reverted).toBe(true);

    const after = await page.evaluate(() => ({
      count: mediaProjectFiles.length,
      paths: mediaProjectFiles.map(function(f) { return f.path; }).sort(),
      processed: mediaProcessedResult
    }));
    expect(after.count).toBe(2);
    expect(after.paths).toEqual(['dup.jpg', 't.jpg']);
    expect(after.processed).toBeNull();
  });

  test('target mode at 100% only removes byte-identical copies', async ({ page }) => {
    const result = await runMediaEngine(page, [
      makeImageAnalyzed('target.jpg', HASH_A, 'same-bytes'),
      makeImageAnalyzed('resized.jpg', HASH_A, 'different-bytes'),
      makeImageAnalyzed('exact.jpg', HASH_A, 'same-bytes')
    ], [], {
      similarity: 100,
      useTargetReference: true,
      targetPath: 'target.jpg',
      targetSig: makeImageAnalyzed('target.jpg', HASH_A, 'same-bytes').sig,
      allowResize: true
    });

    expect(result.removed).toBe(1);
    expect(result.keptPaths).toEqual(['resized.jpg', 'target.jpg']);
  });

  test('report text includes reference target line', async ({ page }) => {
    const report = await page.evaluate(() => {
      var hash = bitsToHex('1111000011110000111100001111000011110000111100001111000011110000');
      var analyzed = [{
        path: 'target.jpg',
        binaryData: new ArrayBuffer(8),
        sig: {
          kind: 'image',
          dHash: hash,
          aHash: hash,
          blockHash: hash,
          detailHash: hash,
          colorHash: hash,
          scales: [hash],
          exactHash: 't',
          width: 100,
          height: 100,
          byteSize: 100
        }
      }];
      var result = processMediaAnalysisResults([], analyzed, {
        similarity: 92,
        useTargetReference: true,
        targetPath: 'target.jpg',
        targetSig: analyzed[0].sig,
        targetBinary: analyzed[0].binaryData,
        allowResize: true
      });
      return buildMediaReportText(result, 12);
    });

    expect(report).toContain('Reference target: target.jpg');
  });

  test('target preview modal renders kept vs removed group', async ({ page }) => {
    await page.evaluate(() => {
      var buf = new ArrayBuffer(8);
      mediaProcessedResult = {
        stats: { filesRemoved: 1, targetMode: true },
        allFiles: [
          { path: 'target.jpg', binaryData: buf, sig: { kind: 'image' } },
          { path: 'dup.jpg', binaryData: buf, sig: { kind: 'image' } }
        ],
        previewGroups: [{
          type: 'target',
          kept: [{ path: 'target.jpg', kind: 'image', binaryData: buf }],
          removed: [{ path: 'dup.jpg', kind: 'image', binaryData: buf }]
        }]
      };
      updateMediaPreviewButton();
      document.getElementById('media-output-container').style.display = 'block';
      document.getElementById('media-preview-open').click();
    });

    await expect(page.locator('#media-preview-modal')).not.toHaveAttribute('hidden', '');
    await expect(page.locator('.media-preview-group h3').first()).toBeVisible();
  });

  test('getMediaProcessOptions wires target reference when enabled', async ({ page }) => {
    await loadSyntheticMediaProject(page, ['photos/hero.jpg']);
    await setMediaTargetFromPath(page, 'photos/hero.jpg');

    const opts = await page.evaluate(() => getMediaProcessOptions());
    expect(opts.useTargetReference).toBe(true);
    expect(opts.targetPath).toBe('photos/hero.jpg');
    expect(opts.targetBinary).toBeTruthy();
  });

  test('verifyMediaResult passes for external target output', async ({ page }) => {
    const check = await page.evaluate(() => {
      var hash = bitsToHex('1111000011110000111100001111000011110000111100001111000011110000');
      var externalSig = {
        kind: 'image',
        dHash: hash,
        aHash: hash,
        blockHash: hash,
        detailHash: hash,
        colorHash: hash,
        scales: [hash],
        exactHash: 'ext',
        width: 100,
        height: 100,
        byteSize: 100
      };
      var analyzed = [{
        path: 'dup.jpg',
        binaryData: new ArrayBuffer(8),
        sig: externalSig
      }];
      var before = analyzed.map(function(f) { return { path: f.path, binaryData: f.binaryData }; });
      var result = processMediaAnalysisResults([], analyzed, {
        similarity: 92,
        useTargetReference: true,
        targetPath: 'external/ref.jpg',
        targetSig: externalSig,
        targetBinary: new ArrayBuffer(8),
        allowResize: true
      });
      return verifyMediaResult(before, result, {
        similarity: 92,
        useTargetReference: true,
        targetPath: 'external/ref.jpg'
      });
    });

    expect(check.passed).toBe(true);
  });
});
