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

/**
 * The breathing animation reaches only the elements that show it. Its values used to be written on the
 * page root every frame, which made the browser restyle the whole command room 60 times a second.
 */
test('the breathing animation moves only what shows it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Enter simulation/ }).click();
  await page.getByRole('button', { name: 'Open full control room' }).click();
  const root = page.locator('div:has(> #session-workspace)');
  const carriers = page.locator('[style*="--breath-phase:"]');
  const grid = page.locator('#session-workspace > div').first();
  const transformOf = (locator: typeof grid) => locator.evaluate((element) => getComputedStyle(element).transform);

  // The breathing ring animates on its own; nothing else carries the values.
  await expect(carriers).toHaveCount(1);
  await expect(root).not.toHaveAttribute('style', /--breath/);
  const ring = carriers.first();
  const before = await transformOf(ring);
  await expect.poll(() => transformOf(ring)).not.toBe(before);

  // Ambient effects: the overlay gets the values and the workspace breathes; switched off, it is still.
  const ambient = page.getByRole('checkbox', { name: 'Ambient visual effects' });
  await ambient.check();
  await expect(carriers).toHaveCount(2);
  await expect.poll(() => grid.evaluate((element) => getComputedStyle(element).filter)).toMatch(/^blur\(/);
  const breathing = await transformOf(grid);
  expect(breathing).not.toBe('none');
  await expect.poll(() => transformOf(grid)).not.toBe(breathing);
  await ambient.uncheck();
  await expect(carriers).toHaveCount(1);
  await expect.poll(() => transformOf(grid)).toBe('none');
  expect(await grid.evaluate((element) => getComputedStyle(element).filter)).toBe('none');
  await expect(root).not.toHaveAttribute('style', /--breath/);
});

/** The microphone drives the breathing animation directly, without re-rendering the command room. */
test('the microphone still drives the command room', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.getByRole('button', { name: /Enter simulation/ }).click();
  await page.getByRole('button', { name: 'Open full control room' }).click();
  const follow = page.getByRole('button', { name: 'Manual' });
  await expect(follow).toBeDisabled();
  await page.getByRole('button', { name: 'Start local audio response' }).click();
  await page.getByRole('button', { name: 'Enable', exact: true }).click();
  await expect(follow).toBeEnabled();
  await follow.click();
  const ring = page.locator('[style*="--breath-phase:"]').first();
  const transformOf = () => ring.evaluate((element) => getComputedStyle(element).transform);
  const before = await transformOf();
  await expect.poll(transformOf).not.toBe(before);
  await expect(page.getByRole('button', { name: 'Audio reactive' })).toBeVisible();
  await page.getByRole('button', { name: 'Stop microphone and tones' }).click();
  await expect(page.getByRole('button', { name: 'Manual' })).toBeDisabled();
  expect(errors).toEqual([]);
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
