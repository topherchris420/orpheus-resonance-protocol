import { expect, test } from '@playwright/test';
import { captureJson, commitCourse, watchErrors, watchExternalRequests, writeJson } from './helpers';

/**
 * The research explorer's journey (at /explore, off the main path): launch the guided scenario, meet conflicting
 * information, review evidence, see the assistant assess and decline, decide, see consequences,
 * inspect the review, replay, compare an assistant condition, and leave with a verifiable record —
 * without an account, an AI service, special hardware or any network request beyond the app itself.
 */
test('a first-time visitor completes the guided journey and leaves with a verifiable record', async ({ page }, testInfo) => {
  const external = watchExternalRequests(page);
  const errors = watchErrors(page);

  await page.goto('/explore/orientation');
  const tour = page.getByRole('region', { name: 'Guided tour' });
  await expect(tour).toContainText('Start the simulated clock');
  await page.getByRole('button', { name: 'Step one simulated second' }).click();

  // Evidence: every item states its kind and source; inspecting provenance advances the tour.
  await expect(tour).toContainText('Check where the evidence comes from');
  const evidence = page.locator('#layer-evidence');
  await expect(evidence.getByText('Thermal UAV pass').first()).toBeVisible();
  await evidence.getByText('Inspect provenance').first().click();
  await expect(tour).toContainText('When the evidence agrees');

  // Agreeing evidence: the assistant concludes and shows why.
  await expect(page.getByRole('region', { name: /^Assistant/ })).toContainText('The evidence supports');
  await commitCourse(page, /Send the resupply team on Route Phoenix/);
  await expect(page.getByRole('dialog', { name: /^Recorded:/ })).toContainText('what was true');
  await page.getByRole('button', { name: 'Continue' }).click();

  // Conflicting reports: the assistant declines and says why.
  await expect(tour).toContainText('When reports disagree');
  const assistant = page.getByRole('region', { name: /^Assistant/ });
  await expect(assistant).toContainText('Insufficient evidence');
  await expect(assistant).toContainText(/disagree/i);
  await commitCourse(page, /Send a drone to look before deciding/);
  await page.getByRole('button', { name: 'Continue' }).click();

  // Unreliable data: integrity failure, a stale reading and a missing check-in are visible as such.
  await expect(tour).toContainText('When the data itself is unreliable');
  await expect(evidence).toContainText('Integrity check failed');
  await expect(evidence).toContainText('Expected but missing');
  await commitCourse(page, /Raise Bravo-2 on the radio first/);
  await page.getByRole('dialog', { name: /^Recorded:/ }).getByRole('button', { name: 'Open after-action review' }).click();

  // Review: what was chosen, what was true, and how the other assistants would have advised.
  const review = page.getByRole('dialog', { name: 'After-action review' });
  await expect(review).toBeVisible();
  await expect(review.getByRole('row', { name: /Total/ })).toBeVisible();
  const record = await captureJson<{ schema: string; header: { seed: string }; log: unknown[] }>(page, () =>
    review.getByRole('button', { name: 'Download session record (JSON)' }).click(),
  );
  expect(record.json.schema).toBe('orpheus.session.v2');
  expect(record.json.header.seed).toBe('orientation-1');
  expect(JSON.stringify(record.json)).not.toMatch(/getUserMedia|userAgent|"audio(Samples|Buffer)"/);

  // Replay the session in place: every checkpoint must match, and the timeline can be stepped.
  await review.getByRole('button', { name: 'Replay this session' }).click();
  await expect(page).toHaveURL(/\/replay/);
  await expect(page.getByText('Exact replay verified')).toBeVisible();
  const stepper = page.getByRole('slider', { name: /^Step \d+ of \d+/ });
  await stepper.focus();
  await page.keyboard.press('End');
  await expect(page.getByText(/^Step (\d+) of \1$/)).toBeVisible();
  await page.keyboard.press('Home');
  await expect(page.getByText(/^Step 0 of \d+$/)).toBeVisible();

  // The downloaded record verifies on its own; an edited copy does not.
  await page.locator('input[type=file]').setInputFiles(record.path);
  await expect(page.getByText('Exact replay verified')).toBeVisible();
  const tampered = structuredClone(record.json) as { log: Array<{ command: Record<string, unknown> }> };
  const commit = tampered.log.find((entry) => entry.command.type === 'commitDecision')!;
  commit.command.confidence = 5;
  await page.locator('input[type=file]').setInputFiles(await writeJson(testInfo.outputPath('tampered.json'), tampered));
  await expect(page.getByText('Not verified')).toBeVisible();
  await expect(page.getByText(/log altered/)).toBeVisible();

  // Compare: play the same seed again with the conventional assistant.
  await page.goto('/explore/orientation?condition=B');
  await expect(page.getByText(/Conventional AI/).first()).toBeVisible();
  await expect(page.getByRole('region', { name: /^Assistant/ })).not.toContainText('Insufficient evidence');

  expect(external, 'no request may leave the app').toEqual([]);
  expect(errors).toEqual([]);
});
