import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __mic: { calls: number; streams: MediaStream[] };
  }
}

/**
 * The microphone is the only measured signal. It must not be requested before explicit consent, and
 * every track must stop when the visitor stops it or leaves the workspace. Chromium runs with a
 * synthetic microphone (see playwright.config.ts).
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__mic = { calls: 0, streams: [] };
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      window.__mic.calls += 1;
      const stream = await original(constraints);
      window.__mic.streams.push(stream);
      return stream;
    };
  });
});

const liveTracks = (page: import('@playwright/test').Page) =>
  page.evaluate(() => window.__mic.streams.flatMap((stream) => stream.getTracks()).filter((track) => track.readyState === 'live').length);

test('the microphone starts only after consent and stops completely', async ({ page }) => {
  await page.goto('/explore/orientation');
  await page.getByText(/^Optional tools/).click();
  const start = page.getByRole('button', { name: 'Start local audio response' });

  await start.click();
  const dialog = page.getByRole('dialog', { name: 'Enable local audio response?' });
  await expect(dialog).toContainText('It does not measure breathing, pulse, HRV, stress');
  await dialog.getByRole('button', { name: 'Not now' }).click();
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => window.__mic.calls)).toBe(0);

  await start.click();
  await page.getByRole('button', { name: 'Enable for this session' }).click();
  await expect(page.getByText(/Microphone connected\. Measured audio energy/)).toBeVisible();
  expect(await page.evaluate(() => window.__mic.calls)).toBe(1);
  expect(await liveTracks(page)).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Stop microphone and tones' }).click();
  await expect.poll(() => liveTracks(page)).toBe(0);
  await expect(page.getByText(/Microphone connected/)).toBeHidden();
});

test('leaving the workspace stops the microphone', async ({ page }) => {
  await page.goto('/explore/orientation');
  await page.getByText(/^Optional tools/).click();
  await page.getByRole('button', { name: 'Start local audio response' }).click();
  await page.getByRole('button', { name: 'Enable for this session' }).click();
  await expect(page.getByText(/Microphone connected/)).toBeVisible();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Method' }).click();
  await expect(page).toHaveURL(/\/method/);
  await expect.poll(() => liveTracks(page)).toBe(0);
});
