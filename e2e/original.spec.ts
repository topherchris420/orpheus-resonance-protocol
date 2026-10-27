import { expect, test } from '@playwright/test';
import { watchErrors, watchExternalRequests } from './helpers';

/** The main experience is the original Orpheus command room, restored unchanged. */
test('the main page opens the original command room', async ({ page }) => {
  const errors = watchErrors(page);
  const external = watchExternalRequests(page);
  await page.goto('/');
  await page.getByRole('button', { name: /Enter simulation/ }).click();
  const views = page.getByRole('navigation', { name: 'Session views' });
  await expect(views).toBeVisible();
  for (const button of await views.getByRole('button').all()) {
    await button.click();
  }
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('the research palette never leaks into the main experience', async ({ page }) => {
  const html = page.locator('html');
  await page.goto('/');
  await expect(html).not.toHaveClass(/o-theme/);
  await page.goto('/method');
  await expect(html).toHaveClass(/o-theme/);
  // Back to the main experience through the in-app link: the class must be removed again.
  await page.getByRole('link', { name: 'ORPHEUS' }).click();
  await expect(page.getByRole('button', { name: /Enter simulation/ })).toBeVisible();
  await expect(html).not.toHaveClass(/o-theme/);
});
