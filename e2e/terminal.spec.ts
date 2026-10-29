import { expect, test, type Page } from '@playwright/test';
import { captureJson, enterCommandRoom, runConsole, watchErrors, watchExternalRequests, writeJson } from './helpers';

/**
 * The main experience: the ORPHEUS access terminal, then the command room, both restored to their
 * original terminal look and running on the deterministic, hash-chained engine.
 */

test('the access terminal types the classic sequence, helps the lost, and runs its self-tests', async ({ page }) => {
  const errors = watchErrors(page);
  const external = watchExternalRequests(page);
  await page.goto('/');
  const output = page.getByRole('log', { name: 'Terminal output' });
  await expect(page.getByRole('heading', { name: 'ORPHEUS ACCESS TERMINAL' })).toBeVisible();
  await expect(output).toContainText('CLASSIFIED SYSTEM ACCESS');
  await expect(output).toContainText('Enter activation phrase to continue:', { timeout: 12_000 });

  const phrase = page.getByLabel('Activation phrase');
  await phrase.fill('0000');
  await phrase.press('Enter');
  await expect(output).toContainText('Access denied. Type HELP for assistance.');
  await expect(page.getByRole('status')).toHaveText('Attempts remaining: 4');
  await phrase.fill('help');
  await phrase.press('Enter');
  await expect(output).toContainText('Activation phrase for this terminal: 1912');

  await phrase.fill('1912');
  await phrase.press('Enter');
  await expect(output).toContainText('> 1912');
  await expect(output).toContainText('[ OK ] SHA-256 known-answer test (FIPS 180-4) · 3/3 vectors');
  await expect(output).toContainText('[ OK ] Engine determinism (Building 47 probe)');
  await expect(output).toContainText('[ OK ] SHA-256 differential vs WebCrypto');
  await expect(output).toContainText('ALL SELF-TESTS PASSED');
  await expect(page.getByRole('navigation', { name: 'Session views' })).toBeVisible();
  await expect(page.getByRole('contentinfo', { name: 'System status' })).toContainText('POST ✓ 8/8');
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('every view of the command room opens without errors', async ({ page }) => {
  const errors = watchErrors(page);
  const external = watchExternalRequests(page);
  await enterCommandRoom(page);
  const views = page.getByRole('navigation', { name: 'Session views' });
  await views.getByRole('button', { name: /^Decisions/ }).click();
  await expect(page.getByRole('heading', { name: 'DECISION MATRIX SIMULATOR' })).toBeVisible();
  await views.getByRole('button', { name: 'Situation map' }).click();
  await expect(page.getByRole('img', { name: /^Tactical map:/ })).toBeVisible();
  await views.getByRole('button', { name: /^After-action/ }).click();
  await expect(page.getByRole('dialog', { name: 'AFTER-ACTION REVIEW' })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Show NeuroSim' }).click();
  await page.getByRole('button', { name: 'Hide NeuroSim' }).click();
  await expect(page.getByRole('img', { name: /^Tactical map:/ })).toBeVisible();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

const cellOverlaps = (page: Page) =>
  page.evaluate(() => {
    const cells = [...document.querySelectorAll('#command-surface > *')].map((element) => element.getBoundingClientRect());
    const overlaps: string[] = [];
    cells.forEach((a, i) =>
      cells.slice(i + 1).forEach((b, offset) => {
        if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) overlaps.push(`${i}×${i + offset + 1}`);
      }),
    );
    return overlaps;
  });

for (const [width, height] of [
  [1280, 800],
  [1440, 900],
  [1920, 1080],
] as const) {
  test(`at ${width}×${height} no panel overlaps another and the status line stays on screen`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await enterCommandRoom(page);
    expect(await page.locator('#command-surface > *').count()).toBe(11);
    expect(await cellOverlaps(page)).toEqual([]);
    const status = await page.getByRole('contentinfo', { name: 'System status' }).boundingBox();
    expect(status && status.y + status.height).toBeLessThanOrEqual(height + 1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test('a course is committed only after an explicit confirmation, and lands in the hash chain', async ({ page }) => {
  await enterCommandRoom(page, 'E2E-COMMIT');
  await page.getByRole('button', { name: /^Decisions · 2$/ }).click();
  const matrix = page.getByRole('region', { name: 'DECISION MATRIX SIMULATOR' });
  await matrix.getByRole('button', { name: /Breach Or Bypass/ }).click();
  await expect(matrix).toContainText('INTEL BASIS · ADMIRALTY GRADED');
  await expect(matrix).toContainText('ANALYST ASSESSMENT · ICD 203');
  await matrix.getByRole('button', { name: 'Commit course: Hold and call for ISR' }).click();
  await matrix.getByRole('button', { name: 'CANCEL' }).click();
  await expect(page.getByRole('button', { name: /^After-action · 0$/ })).toBeVisible();
  await matrix.getByRole('button', { name: 'Commit course: Hold and call for ISR' }).click();
  await matrix.getByRole('button', { name: 'CONFIRM COMMIT' }).click();
  await expect(page.getByRole('button', { name: /^After-action · 1$/ })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Operator Event Timeline' })).toContainText('Course committed');

  await page.getByRole('button', { name: /^After-action/ }).click();
  const review = page.getByRole('dialog', { name: 'AFTER-ACTION REVIEW' });
  await expect(review).toContainText('Hold and call for ISR');
  await expect(review).toContainText('Ground truth');
  await expect(review).toContainText('NO ASSUMPTION MADE');
});

test('the operator console briefs, commits with confirmation, and verifies the session from its seed', async ({ page }) => {
  await enterCommandRoom(page, '7F3A-91C2');
  let log = await runConsole(page, 'status');
  await expect(log).toContainText('SUBPROTOCOL ORPHEUS · BUILDING 47');
  await expect(log).toContainText('seed 7F3A-91C2');
  log = await runConsole(page, 'brief 1');
  await expect(log).toContainText('ANALYST · UNCERTAINTY-AWARE · ICD 203');
  await expect(log).toContainText(/CONFIDENCE (HIGH|MODERATE|LOW)/);
  log = await runConsole(page, 'commit 1 3');
  await expect(log).toContainText('[y/N]');
  log = await runConsole(page, 'y');
  await expect(log).toContainText('COURSE COMMITTED');
  log = await runConsole(page, 'verify');
  await expect(log).toContainText('VERIFIED — the record reproduces the live session exactly.');
  log = await runConsole(page, 'egress');
  await expect(log).toContainText('✓ NO EXTERNAL EMISSIONS');
  await runConsole(page, 'launch');
  await expect(log).toContainText('orpheus: command not found: launch');
  const prompt = page.getByLabel('Console command');
  const consoleDialog = page.getByRole('dialog', { name: 'Operator console' });
  await prompt.press('Escape');
  await expect(consoleDialog).toHaveCount(0);
  // A backtick typed inside a command is a character; on an empty prompt it closes the console.
  await page.locator('body').press('`');
  await expect(prompt).toBeFocused();
  await prompt.pressSequentially('a`b');
  await expect(prompt).toHaveValue('a`b');
  await expect(consoleDialog).toBeVisible();
  await prompt.fill('');
  await prompt.press('`');
  await expect(consoleDialog).toHaveCount(0);
});

/** The state hash after exactly `tick` simulated seconds, read from the console. */
const stateHashAt = async (page: Page, tick: number) => {
  let log = await runConsole(page, 'pause');
  await expect(log).toContainText('clock PAUSED');
  log = await runConsole(page, 'status');
  const status = await log.textContent();
  const elapsed = [...(status ?? '').matchAll(/T\+(\d+):(\d+)/g)].pop()!;
  const now = Number(elapsed[1]) * 60 + Number(elapsed[2]);
  expect(now).toBeLessThan(tick);
  await runConsole(page, `step ${tick - now}`);
  log = await runConsole(page, 'seal');
  const text = (await log.textContent()) ?? '';
  return [...text.matchAll(/state {4}([0-9a-f]{64})/g)].pop()![1];
};

test('the same seed builds a bit-identical world in two independent sessions', async ({ browser }) => {
  const first = await browser.newPage();
  const second = await browser.newPage();
  await enterCommandRoom(first, 'TWIN-SEED');
  await enterCommandRoom(second, 'TWIN-SEED');
  const [a, b] = await Promise.all([stateHashAt(first, 90), stateHashAt(second, 90)]);
  expect(a).toMatch(/^[0-9a-f]{64}$/);
  expect(a).toBe(b);
  await first.close();
  await second.close();
});

test('an exported record verifies in the replay page, and an edited copy does not', async ({ page }, testInfo) => {
  await enterCommandRoom(page, 'E2E-RECORD');
  await page.getByRole('button', { name: /^Decisions/ }).click();
  await page.getByRole('button', { name: /Breach Or Bypass/ }).click();
  await page.getByRole('button', { name: 'Commit course: Bypass via rooftop route' }).click();
  await page.getByRole('button', { name: 'CONFIRM COMMIT' }).click();
  const record = await captureJson<{ schema: string; header: { seed: string; scenario: { id: string } }; log: Array<{ command: Record<string, unknown> }> }>(page, () =>
    page.getByRole('button', { name: 'Export simulation record' }).click(),
  );
  expect(record.name).toMatch(/^orpheus-session-E2E-RECORD-[0-9A-F]{4}-[0-9A-F]{4}\.json$/);
  expect(record.json.schema).toBe('orpheus.session.v2');
  expect(record.json.header).toMatchObject({ seed: 'E2E-RECORD', scenario: { id: 'building-47' } });
  expect(JSON.stringify(record.json)).not.toMatch(/getUserMedia|userAgent|"audio(Samples|Buffer)"/);

  await page.getByRole('button', { name: /^After-action/ }).click();
  await page.getByRole('button', { name: 'VERIFY IN REPLAY' }).click();
  await expect(page).toHaveURL(/\/replay/);
  await expect(page.getByText('Exact replay verified')).toBeVisible();

  await page.locator('input[type=file]').setInputFiles(record.path);
  await expect(page.getByText('Exact replay verified')).toBeVisible();
  const tampered = structuredClone(record.json);
  tampered.log.find((entry) => entry.command.type === 'commitDecision')!.command.optionId = 'dp-breach-dynamic';
  await page.locator('input[type=file]').setInputFiles(await writeJson(testInfo.outputPath('tampered.json'), tampered));
  await expect(page.getByText('Not verified')).toBeVisible();
});

/**
 * The breathing animation reaches only the elements that show it: the ring and the ambient overlay
 * get the live values, the grid only a compositor transform (no blur, which would soften every glyph).
 */
test('the breathing animation moves only what shows it, and never blurs the text', async ({ page }) => {
  await enterCommandRoom(page);
  const carriers = page.locator('[style*="--breath-phase:"]');
  const grid = page.locator('#command-surface');
  const root = page.locator('div:has(> #command-surface)');
  await expect(carriers).toHaveCount(2);
  await expect(root).not.toHaveAttribute('style', /--breath/);
  const transformOf = () => grid.evaluate((element) => getComputedStyle(element).transform);
  const before = await transformOf();
  expect(before).not.toBe('none');
  await expect.poll(transformOf).not.toBe(before);
  expect(await grid.evaluate((element) => getComputedStyle(element).filter)).toBe('none');
});

test('with reduced motion the terminal prints at once and nothing breathes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('log', { name: 'Terminal output' })).toContainText('Enter activation phrase to continue:', { timeout: 1_500 });
  const phrase = page.getByLabel('Activation phrase');
  await phrase.fill('1912');
  await phrase.press('Enter');
  await expect(page.getByRole('navigation', { name: 'Session views' })).toBeVisible();
  expect(await page.locator('#command-surface').evaluate((element) => getComputedStyle(element).transform)).toBe('none');
  await expect(page.locator('.ambient-overlays')).toHaveCount(0);
});

test('the microphone starts only after consent, drives the breathing ring, and stops completely', async ({ page }) => {
  const errors = watchErrors(page);
  await enterCommandRoom(page);
  const follow = page.getByRole('button', { name: 'Manual' });
  await expect(follow).toBeDisabled();
  await page.getByRole('button', { name: 'Start local audio response' }).click();
  await page.getByRole('button', { name: 'Enable', exact: true }).click();
  await expect(follow).toBeEnabled();
  await follow.click();
  await expect(page.getByRole('button', { name: 'Audio reactive' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Operator Event Timeline' })).toContainText('Microphone enabled');
  await page.getByRole('button', { name: 'Stop microphone and tones' }).click();
  await expect(page.getByRole('button', { name: 'Manual' })).toBeDisabled();
  expect(errors).toEqual([]);
});

test('the research palette never leaks into the command room', async ({ page }) => {
  const html = page.locator('html');
  await page.goto('/');
  await expect(html).not.toHaveClass(/o-theme/);
  await page.goto('/method');
  await expect(html).toHaveClass(/o-theme/);
  await page.getByRole('link', { name: 'ORPHEUS' }).click();
  await expect(page.getByRole('heading', { name: 'ORPHEUS ACCESS TERMINAL' })).toBeVisible();
  await expect(html).not.toHaveClass(/o-theme/);
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(0, 0, 0)');
});
