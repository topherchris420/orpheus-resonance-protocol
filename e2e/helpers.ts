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
