import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { captureJson, watchErrors, writeJson } from './helpers';

test.describe('research workbench', () => {
  test('runs the protocol with simulated participants, exports a package and reproduces it exactly', async ({ page }, testInfo) => {
    const errors = watchErrors(page);
    await page.goto('/research?tab=simulate');
    await page.getByLabel('Participants per policy').fill('2');
    // A custom design: degraded information only, and no explainable-AI condition.
    await page.getByRole('button', { name: 'Degraded information only' }).click();
    await page.getByRole('checkbox', { name: 'C · Explainable AI' }).uncheck();
    await expect(page.getByText(/Custom design · 240 scored trials/)).toBeVisible();
    await page.getByRole('button', { name: 'Run experiment' }).click();

    // Results open automatically, labeled as simulated.
    await expect(page.getByRole('tab', { name: /Results/, selected: true })).toBeVisible();
    const results = page.getByRole('tabpanel', { name: /Results/ });
    await expect(results.getByRole('note')).toContainText('Simulated agents, not human data');
    await expect(results.getByRole('figure', { name: /Mean decision utility per trial by assistance condition/ })).toBeVisible();
    await expect(results.getByRole('region', { name: 'Metrics by condition' }).getByRole('rowheader', { name: 'Decision utility' })).toBeVisible();
    await expect(results.getByRole('heading', { name: 'Preregistered hypotheses' })).toBeVisible();
    await expect(results.getByText(/conditions A, B, D · custom evidence mix \(8 trials per block: conflict, missing, stale, corrupted\)/)).toBeVisible();

    // Error inspection opens the evidence and assistant output behind a wrong conclusion.
    const firstError = results.getByRole('heading', { name: 'Error inspection' }).locator('..').getByRole('button', { name: /truth/ }).first();
    if (await firstError.count()) {
      await firstError.click();
      await expect(results.getByRole('region', { name: 'Evidence' })).toBeVisible();
    }

    const pkg = await captureJson<{ contentHash: string; content: { kind: string; trials: Array<{ utility: number }> } }>(page, () =>
      results.getByRole('button', { name: 'Research package (JSON)' }).click(),
    );
    expect(pkg.json.content.kind).toBe('agent-batch');
    expect(pkg.json.content.trials).toHaveLength(5 * 2 * 3 * 8);

    // Reproduce: the exported package verifies, and regenerating it gives the same content hash.
    await page.getByRole('tab', { name: 'Reproduce' }).click();
    await page.locator('#package-file').setInputFiles(pkg.path);
    const verification = page.getByRole('tabpanel', { name: 'Reproduce' });
    await expect(verification.getByRole('heading', { name: 'Verified' })).toBeVisible({ timeout: 60_000 });
    await expect(verification.getByText('Regenerated batch has the identical content hash: yes')).toBeVisible();
    await expect(verification.getByText(/Sessions reproduced by replay \(10 of 10\): yes/)).toBeVisible();

    // An edited package is caught.
    const edited = structuredClone(pkg.json);
    edited.content.trials[0].utility += 1;
    await page.locator('#package-file').setInputFiles(await writeJson(testInfo.outputPath('edited.json'), edited));
    await expect(verification.getByRole('heading', { name: 'Verification failed' })).toBeVisible({ timeout: 60_000 });
    await expect(verification.getByText('Content hash matches: no')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('the default design reproduces, in the browser, the package hash generated in Node', async ({ page }) => {
    test.setTimeout(180_000);
    const runs = JSON.parse(readFileSync(new URL('../docs/results/baseline-agents.summary.json', import.meta.url), 'utf8')) as Array<{ title: string; contentHash: string }>;
    const expected = runs.find((run) => run.title === 'Workbench default')!.contentHash;
    await page.goto('/research?tab=simulate');
    await expect(page.getByText(/Protocol design · 1,920 scored trials/)).toBeVisible();
    await page.getByRole('button', { name: 'Run experiment' }).click();
    const results = page.getByRole('tabpanel', { name: /Results/ });
    await expect(results.getByText(/content hash/)).toBeVisible({ timeout: 150_000 });
    const pkg = await captureJson<{ contentHash: string }>(page, () => results.getByRole('button', { name: 'Research package (JSON)' }).click());
    expect(pkg.json.contentHash).toBe(expected);
  });

  test('re-runs the committed calibration evaluation and reproduces it exactly', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await page.goto('/research?tab=calibration');
    const panel = page.getByRole('tabpanel', { name: 'Calibration' });
    await expect(panel.getByText('Committed evaluation record', { exact: false })).toBeVisible();
    await panel.getByRole('combobox', { name: /^Trials/ }).selectOption('20000');
    await panel.getByRole('button', { name: 'Evaluate' }).click();
    await expect(panel.getByText('Reproduced: every number matches the committed record.')).toBeVisible({ timeout: 150_000 });
    await expect(panel.getByRole('row', { name: /aware-bayes-v1/ })).toBeVisible();
    await expect(panel.getByRole('row', { name: /naive-bayes-v1/ })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('documents its protocol and assumptions', async ({ page }) => {
    await page.goto('/research');
    await expect(page.getByRole('heading', { name: 'Hypotheses' })).toBeVisible();
    const protocol = await captureJson<{ protocol: { id: string }; hash: string }>(page, () => page.getByRole('button', { name: 'Download protocol (JSON)' }).click());
    expect(protocol.json.protocol.id).toBe('orpheus-hat');
    expect(protocol.json.hash).toMatch(/^[0-9a-f]{64}$/);
    await page.getByRole('tab', { name: 'Assumptions' }).click();
    await expect(page.getByRole('heading', { name: /Source model/ })).toBeVisible();
    await expect(page.getByText('No inferred signals', { exact: false })).toBeVisible();
  });
});
