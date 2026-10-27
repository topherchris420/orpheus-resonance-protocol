import { expect, test, type Page } from '@playwright/test';
import { captureJson, watchErrors, watchExternalRequests } from './helpers';

const VERIFY = 'Not established — verify first';

/** Starts a demonstration session and gives consent; returns the participant code. */
const startDemo = async (page: Page) => {
  await page.goto('/study');
  await page.getByRole('radio', { name: /Demonstration/ }).check();
  const code = (await page.locator('output').first().textContent())!.trim();
  expect(code).toMatch(/^P-[A-HJ-NP-Z2-9]{6}$/);
  await page.getByRole('button', { name: 'Hand over to the participant' }).click();
  await expect(page.getByRole('heading', { name: 'Deciding what the evidence shows' })).toBeVisible();
  const start = page.getByRole('button', { name: 'Start the practice' });
  await expect(start).toBeDisabled();
  await page.getByRole('checkbox', { name: /agree to take part/ }).check();
  await start.click();
  return code;
};

const trialEyebrow = (page: Page) => page.locator('main header p.o-eyebrow');

/** Answers the trial on screen ("verify first", or keeps the first answer) and waits for the next screen. */
const answerTrial = async (page: Page) => {
  const before = (await trialEyebrow(page).textContent()) ?? '';
  const submit = page.getByRole('button', { name: /^Submit/ });
  const label = (await submit.textContent()) ?? '';
  if (label.includes('see the assistant')) {
    await expect(page.getByText('The assistant’s assessment appears after you give your own answer.')).toBeVisible();
  }
  if (label.includes('final answer')) {
    // Sequential advice: the first answer is shown and pre-selected, the assistant's output is visible.
    await expect(page.getByText('Your first answer:')).toBeVisible();
    await expect(page.getByText('AI statement, not evidence')).toBeVisible();
  } else {
    await page.getByRole('radio', { name: VERIFY }).check();
  }
  await submit.click();
  // The next screen is another stage or trial (new heading line), or no trial at all (intro or questionnaire).
  await expect
    .poll(async () => ((await trialEyebrow(page).count()) === 0 ? null : await trialEyebrow(page).textContent()))
    .not.toBe(before);
};

const answerQuestionnaire = async (page: Page) => {
  for (const subscale of ['Mental demand', 'Physical demand', 'Temporal demand', 'Performance', 'Effort', 'Frustration']) {
    await page.getByRole('slider', { name: subscale }).focus();
    await page.keyboard.press('ArrowRight');
  }
  for (const number of [1, 2, 3, 4]) {
    await page.getByRole('group', { name: new RegExp(`^${number}\\.`) }).getByRole('radio').nth(1).check();
  }
  await page.getByRole('radio', { name: '5', exact: true }).check({ force: true });
  await page.getByRole('button', { name: 'Continue' }).click();
};

/** Drives the session from the practice introduction to the end. */
const completeSession = async (page: Page) => {
  const intro = page.getByRole('button', { name: /^Start the (practice|block)$/ });
  const questionnaire = page.getByRole('heading', { name: 'A few questions about this block' });
  const done = page.getByRole('heading', { name: 'Thank you for taking part.' });
  const submit = page.getByRole('button', { name: /^Submit/ });
  for (let guard = 0; guard < 120; guard += 1) {
    await expect(intro.or(questionnaire).or(done).or(submit).first()).toBeVisible();
    if (await done.isVisible()) return;
    if (await intro.isVisible()) await intro.click();
    else if (await questionnaire.isVisible()) {
      await answerQuestionnaire(page);
      await expect(questionnaire).toBeHidden();
    } else await answerTrial(page);
  }
  throw new Error('The session did not finish');
};

test.describe('study runner', () => {
  test('a participant completes a session; the package verifies by replay and is kept out of protocol analyses', async ({ page }) => {
    test.setTimeout(180_000);
    const external = watchExternalRequests(page);
    const errors = watchErrors(page);
    const code = await startDemo(page);
    await completeSession(page);

    const pkg = await captureJson<{
      content: {
        kind: string;
        participants: Array<{ code: string; status: string; conditionOrder: string[] }>;
        trials: Array<{ condition: string; initialOption: string | null; finalLatencyMs: number }>;
        questionnaires: unknown[];
      };
    }>(page, () => page.getByRole('button', { name: 'Participant package (JSON)' }).click());
    const content = pkg.json.content;
    expect(content.kind).toBe('human-study');
    expect(content.participants).toEqual([expect.objectContaining({ code, status: 'complete' })]);
    expect(content.trials).toHaveLength(16);
    expect(content.questionnaires).toHaveLength(4);
    for (const trial of content.trials) {
      expect(trial.initialOption === null).toBe(trial.condition === 'A');
      expect(trial.finalLatencyMs).toBeGreaterThan(0);
    }
    expect(JSON.stringify(pkg.json)).not.toMatch(/userAgent|getUserMedia|[\w.+-]+@[\w-]+\.[a-z]{2,}/i);

    await page.getByRole('button', { name: 'Open in the Research workbench' }).click();
    await expect(page).toHaveURL(/\/research\?tab=results/);
    const results = page.getByRole('tabpanel', { name: /Results/ });
    await expect(results.getByRole('button', { name: 'Participants' })).toBeVisible();
    await expect(results.getByRole('note')).toHaveCount(0);

    await page.getByRole('tab', { name: 'Reproduce' }).click();
    await page.locator('#package-file').setInputFiles(pkg.path);
    const reproduce = page.getByRole('tabpanel', { name: 'Reproduce' });
    await expect(reproduce.getByRole('heading', { name: 'Verified' })).toBeVisible();
    await expect(reproduce.getByText(/Sessions reproduced by replay \(1 of 1\): yes/)).toBeVisible();

    await page.getByRole('tab', { name: 'Human study' }).click();
    await page.locator('#study-packages').setInputFiles(pkg.path);
    await expect(page.getByText(`Not combined: ${code} (Shortened session (4 trials per block instead of 12).)`)).toBeVisible();

    expect(external).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('a participant can stop at any time and the record is marked withdrawn', async ({ page }) => {
    await startDemo(page);
    await page.getByRole('button', { name: 'Start the practice' }).click();
    await answerTrial(page);
    await page.getByRole('button', { name: 'Stop session' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Stop', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'You stopped the session. Thank you for your time.' })).toBeVisible();
    const pkg = await captureJson<{ content: { participants: Array<{ status: string }>; trials: unknown[] } }>(page, () =>
      page.getByRole('button', { name: 'Participant package (JSON)' }).click(),
    );
    expect(pkg.json.content.participants[0].status).toBe('withdrawn');
    expect(pkg.json.content.trials).toHaveLength(0);
  });

  test('an interrupted session resumes from its log after a reload', async ({ page }) => {
    await startDemo(page);
    await page.getByRole('button', { name: 'Start the practice' }).click();
    await answerTrial(page);
    await expect(trialEyebrow(page)).toHaveText('Practice · trial 2 of 2');

    const dialogs: string[] = [];
    page.on('dialog', (dialog) => {
      dialogs.push(dialog.type());
      void dialog.accept();
    });
    await page.reload();
    expect(dialogs).toContain('beforeunload');

    await expect(page.getByRole('heading', { name: 'An unfinished session is stored in this tab' })).toBeVisible();
    await page.getByRole('button', { name: 'Resume this session' }).click();
    await page.getByRole('button', { name: 'Start the practice' }).click();
    await expect(trialEyebrow(page)).toHaveText('Practice · trial 2 of 2');
  });
});
