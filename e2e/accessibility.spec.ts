import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { enterCommandRoom, runConsole } from './helpers';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Waits until no finite animation is running, so contrast is measured on settled, fully opaque content. */
const settle = (page: Page) =>
  page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== 'running' || animation.effect?.getComputedTiming().iterations === Infinity),
  );

/** Runs axe against the page (or one part of it) and fails with a readable list of violations. */
const expectNoViolations = async (page: Page, label: string, include?: string) => {
  await settle(page);
  let builder = new AxeBuilder({ page }).withTags(WCAG);
  if (include) builder = builder.include(include);
  const { violations } = await builder.analyze();
  const summary = violations.map((violation) => `${violation.id} (${violation.impact}): ${violation.nodes.map((node) => node.target.join(' ')).slice(0, 4).join(' | ')}`);
  expect(summary, `${label}: axe violations`).toEqual([]);
};

/** The command room at /: the access terminal, the room, its dialogs and the operator console. */
test.describe('command room accessibility (axe, WCAG 2.2 AA rules)', () => {
  test('the access terminal has no detectable violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('log', { name: 'Terminal output' })).toContainText('CLASSIFIED SYSTEM ACCESS');
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Activation phrase')).toBeVisible();
    await expectNoViolations(page, 'access terminal');
  });

  test('the command room has no detectable violations', async ({ page }) => {
    await enterCommandRoom(page);
    await expectNoViolations(page, 'command room');
  });

  test('the decision matrix, the console and the after-action review have no detectable violations', async ({ page }) => {
    await enterCommandRoom(page);
    await page.getByRole('button', { name: /^Decisions/ }).click();
    await expect(page.getByRole('heading', { name: 'DECISION MATRIX SIMULATOR' })).toBeVisible();
    await expectNoViolations(page, 'decision matrix', '#command-surface');
    await runConsole(page, 'brief 1');
    await expectNoViolations(page, 'operator console', '[aria-label="Operator console"]');
    await page.getByLabel('Console command').press('Escape');
    await page.getByRole('button', { name: /^After-action/ }).click();
    await expect(page.getByRole('dialog', { name: 'AFTER-ACTION REVIEW' })).toBeVisible();
    await expectNoViolations(page, 'after-action review', '[role="dialog"]');
  });

  test('the microphone consent dialog has no detectable violations', async ({ page }) => {
    await enterCommandRoom(page);
    await page.getByRole('button', { name: 'Start local audio response' }).click();
    await expect(page.getByRole('dialog', { name: 'Enable local audio response' })).toBeVisible();
    await expectNoViolations(page, 'consent dialog', '[role="dialog"]');
  });
});

/** The research tools. */
test.describe('accessibility (axe, WCAG 2.2 AA rules)', () => {
  for (const [route, label] of [
    ['/explore/orientation', 'guided scenario'],
    ['/explore/building-47', 'full mission'],
    ['/research', 'research: protocol'],
    ['/research?tab=simulate', 'research: simulate'],
    ['/research?tab=study', 'research: human study'],
    ['/research?tab=results', 'research: results (empty)'],
    ['/research?tab=calibration', 'research: calibration'],
    ['/research?tab=reproduce', 'research: reproduce'],
    ['/research?tab=assumptions', 'research: assumptions'],
    ['/study', 'study setup'],
    ['/replay', 'replay (empty)'],
    ['/method', 'method'],
  ] as const) {
    test(`${label} has no detectable violations`, async ({ page }) => {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await expectNoViolations(page, label);
    });
  }

  test('decision dialogs, outcome and review have no detectable violations', async ({ page }) => {
    await page.goto('/explore/orientation');
    await page.getByRole('radio', { name: /Send the resupply team on Route Phoenix/ }).check();
    await page.getByRole('button', { name: 'Review course →' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expectNoViolations(page, 'commit dialog', '[role="alertdialog"]');
    await page.getByRole('button', { name: 'Confirm choice' }).click();
    await expect(page.getByRole('dialog', { name: /^Recorded:/ })).toBeVisible();
    await expectNoViolations(page, 'outcome dialog', '[role="dialog"]');
    await page.getByRole('button', { name: 'Open after-action review' }).click();
    await expect(page.getByRole('dialog', { name: 'After-action review' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: /^Recorded:/ })).toHaveCount(0);
    await expectNoViolations(page, 'after-action review', '[role="dialog"]');
  });

  test('the microphone consent dialog has no detectable violations', async ({ page }) => {
    await page.goto('/explore/orientation');
    await page.getByText(/^Optional tools/).click();
    await page.getByRole('button', { name: 'Start local audio response' }).click();
    await expect(page.getByRole('dialog', { name: 'Enable local audio response?' })).toBeVisible();
    await expectNoViolations(page, 'consent dialog', '[role="dialog"]');
  });

  test('study screens have no detectable violations', async ({ page }) => {
    await page.goto('/study');
    await page.getByRole('radio', { name: /Demonstration/ }).check();
    await page.getByRole('button', { name: 'Hand over to the participant' }).click();
    await expectNoViolations(page, 'participant information');
    await page.getByRole('checkbox', { name: /agree to take part/ }).check();
    await page.getByRole('button', { name: 'Start the practice' }).click();
    await expectNoViolations(page, 'practice introduction');
    await page.getByRole('button', { name: 'Start the practice' }).click();
    await expect(page.getByRole('button', { name: 'Submit answer' })).toBeVisible();
    await expectNoViolations(page, 'trial');
  });

  test('a loaded replay has no detectable violations', async ({ page }) => {
    await page.goto('/explore/orientation');
    await page.getByRole('radio', { name: /Send the resupply team on Route Phoenix/ }).check();
    await page.getByRole('button', { name: 'Review course →' }).click();
    await page.getByRole('button', { name: 'Confirm choice' }).click();
    await page.getByRole('button', { name: 'Open after-action review' }).click();
    await page.getByRole('button', { name: 'Replay this session' }).click();
    await expect(page.getByText('Exact replay verified')).toBeVisible();
    await expectNoViolations(page, 'replay');
  });
});

test.describe('keyboard and motion', () => {
  test('the skip link moves focus to the main content', async ({ page }) => {
    await page.goto('/method');
    // The research pages load on demand; wait until the page is there before using the keyboard.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
  });

  test('a decision can be made with the keyboard alone', async ({ page }) => {
    await page.goto('/explore/orientation');
    const course = page.getByRole('radio', { name: /Send the resupply team on Route Phoenix/ });
    await course.focus();
    await page.keyboard.press('Space');
    await expect(course).toBeChecked();
    const review = page.getByRole('button', { name: 'Review course →' });
    await review.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('alertdialog', { name: 'Commit this course?' });
    await expect(dialog).toBeVisible();
    // Focus is trapped in the dialog; reach "Confirm choice" with Tab.
    for (let presses = 0; presses < 6 && !(await dialog.getByRole('button', { name: 'Confirm choice' }).evaluate((element) => element === document.activeElement)); presses += 1) {
      await page.keyboard.press('Tab');
    }
    await expect(dialog.getByRole('button', { name: 'Confirm choice' })).toBeFocused();
    await page.keyboard.press('Enter');
    const outcome = page.getByRole('dialog', { name: /^Recorded:/ });
    await expect(outcome).toBeVisible();
    // Escape must reach the outcome dialog, not the confirmation dialog that is still closing.
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(outcome).toContainText('what was true');
    await page.keyboard.press('Escape');
    await expect(outcome).toBeHidden();
  });

  test('reduced motion stops the study pacing stimulus and the ambient effects', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/study');
    await page.getByRole('radio', { name: 'On for this participant' }).check();
    await expect(page.getByRole('alert')).toContainText('reduced motion');
    await page.getByRole('radio', { name: /Demonstration/ }).check();
    await page.getByRole('button', { name: 'Hand over to the participant' }).click();
    await page.getByRole('checkbox', { name: /agree to take part/ }).check();
    await page.getByRole('button', { name: 'Start the practice' }).click();
    const pacer = page.locator('.ambient-pacer');
    await expect(pacer).toHaveCount(1);
    const duration = await pacer.evaluate((element) => Number.parseFloat(getComputedStyle(element).animationDuration));
    expect(duration).toBeLessThan(0.01);
  });
});
