import { expect, test } from '@playwright/test';

/** Phone-width layout: no horizontal page scroll, and the three layers stay reachable. */
for (const route of ['/explore/orientation', '/research', '/research?tab=assumptions', '/study', '/replay', '/method']) {
  test(`${route} fits a phone screen without horizontal scrolling`, async ({ page }) => {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test('the explorer switches between layers on a phone', async ({ page }) => {
  await page.goto('/explore/orientation');
  const layers = page.getByRole('group', { name: 'Show layer' });
  await layers.getByRole('button', { name: 'Decision' }).click();
  await expect(page.getByRole('radio', { name: /Send the resupply team on Route Phoenix/ })).toBeVisible();
  await layers.getByRole('button', { name: 'Situation' }).click();
  await expect(page.getByRole('heading', { name: 'Situation map' })).toBeVisible();
});
