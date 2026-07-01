import { test, expect } from '@playwright/test';

const LANDING_PAGES = [
  { path: '/text-file/', slug: 'text-file', section: 's-1' },
  { path: '/folder-zip/', slug: 'folder-zip', section: 's-4' },
  { path: '/image-video/', slug: 'image-video', section: 's-5' }
];

test.describe('SEO landing pages', () => {
  for (const page of LANDING_PAGES) {
    test(`${page.path} redirects to /#${page.slug} and opens the tab`, async ({ page: browserPage }) => {
      await browserPage.goto(page.path);
      await browserPage.waitForURL(new RegExp('/#' + page.slug + '$'));
      await expect(browserPage.locator('#' + page.section)).toHaveClass(/current/);
      await expect(browserPage.locator('#' + page.section)).not.toHaveAttribute('hidden', '');
    });
  }
});
