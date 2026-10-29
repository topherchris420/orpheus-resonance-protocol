import { readFile, writeFile } from 'node:fs/promises';
import { expect, type Page } from '@playwright/test';

/** Clicks something that triggers a download and returns the saved file's path and parsed JSON. */
export const captureJson = async <T = unknown>(page: Page, trigger: () => Promise<unknown>) => {
  const [download] = await Promise.all([page.waitForEvent('download'), trigger()]);
  const path = await download.path();
  if (!path) throw new Error('Download failed');
  return { path, name: download.suggestedFilename(), json: JSON.parse(await readFile(path, 'utf8')) as T };
};

export const writeJson = async (path: string, value: unknown) => {
  await writeFile(path, JSON.stringify(value));
  return path;
};

/** Chooses a course in the Decision layer, reviews it and confirms it. */
export const commitCourse = async (page: Page, course: RegExp) => {
  await page.getByRole('radio', { name: course }).check();
  await page.getByRole('button', { name: 'Review course →' }).click();
  await expect(page.getByRole('alertdialog', { name: 'Commit this course?' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm choice' }).click();
  await expect(page.getByRole('dialog', { name: /^Recorded:/ })).toBeVisible();
};

/** Collects requests to any host other than the local preview server. */
export const watchExternalRequests = (page: Page) => {
  const external: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname) && !['data:', 'blob:'].includes(url.protocol)) external.push(request.url());
  });
  return external;
};

/** Fails on uncaught exceptions and console errors. */
export const watchErrors = (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
};

/**
 * Opens the access terminal, skips the boot sequence (Enter, as on a real console), enters the
 * activation phrase, and waits until the power-on self-tests have passed and the command room is up.
 */
export const enterCommandRoom = async (page: Page, seed?: string) => {
  await page.goto(seed ? `/?seed=${encodeURIComponent(seed)}` : '/');
  await expect(page.getByRole('log', { name: 'Terminal output' })).toContainText('CLASSIFIED SYSTEM ACCESS');
  await page.keyboard.press('Enter');
  const phrase = page.getByLabel('Activation phrase');
  await phrase.fill('1912');
  await phrase.press('Enter');
  await expect(page.getByRole('navigation', { name: 'Session views' })).toBeVisible();
};

/** Opens the operator console (backtick) and runs one command; returns the console output region. */
export const runConsole = async (page: Page, command: string) => {
  const input = page.getByLabel('Console command');
  if (!(await input.isVisible())) {
    await page.locator('body').press('`');
    await expect(input).toBeFocused();
  }
  await input.fill(command);
  await input.press('Enter');
  return page.getByRole('log', { name: 'Console output' });
};
