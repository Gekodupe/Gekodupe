import { test, expect } from '@playwright/test';

const TAB_ROUTES = [
  { hash: 'text-file', section: 's-1' },
  { hash: 'folder-zip', section: 's-4' },
  { hash: 'image-video', section: 's-5' },
  { hash: 'demo', section: 's-2' },
  { hash: 'info', section: 's-3' }
];

test.describe('URL routing', () => {
  for (const route of TAB_ROUTES) {
    test(`/#${route.hash} opens the ${route.section} tab`, async ({ page }) => {
      await page.goto('/#' + route.hash);
      await expect(page.locator('#' + route.section)).toHaveClass(/current/);
      await expect(page.locator('#' + route.section)).not.toHaveAttribute('hidden', '');
      expect(page.url()).toMatch(new RegExp('/#' + route.hash + '$'));
    });
  }

  test('unknown hash falls back to text-file', async ({ page }) => {
    await page.goto('/#not-a-real-tab');
    await expect(page.locator('#s-1')).toHaveClass(/current/);
    expect(page.url()).toMatch(/\/#text-file$/);
  });

  test('404 redirects to /#text-file from nested paths', async ({ page }) => {
    await page.goto('/does/not/exist');
    await page.waitForURL(/\/#text-file$/);
    await expect(page.locator('#s-1')).toHaveClass(/current/);
  });
});
