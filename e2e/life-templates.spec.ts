import { test, expect } from '@playwright/test';
import { skipOnboarding } from './helpers';

/**
 * Life templates: one tap creates a localized project with its tasks and
 * habits; Pro-only templates on Free link to pricing instead.
 */
test.describe('Life templates', () => {
  test('Exam prep creates the project, 5 tasks and a habit', async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/');
    await page.getByRole('tab', { name: 'Projects', exact: true }).click();

    const section = page.getByTestId('life-templates');
    await expect(section.getByText('Ready-made systems', { exact: true })).toBeVisible();
    const exam = page.getByTestId('tpl-exam');
    await exam.getByRole('button', { name: 'Use Exam prep', exact: true }).click();
    await exam.getByRole('button', { name: 'Create', exact: true }).click();

    await expect(page.getByText('Exam prep is ready.')).toBeVisible();
    // The new project opens by itself and scrolls into view.
    const collapse = page.getByRole('button', { name: 'Collapse Exam prep', exact: true });
    await expect(collapse).toBeVisible();
    await expect(collapse).toBeInViewport();

    await expect
      .poll(() =>
        page.evaluate(() => {
          const projects = JSON.parse(localStorage.getItem('moneo:projects') ?? '[]') as {
            id: string;
            name: string;
          }[];
          const tasks = JSON.parse(localStorage.getItem('moneo:tasks') ?? '[]') as {
            projectId: string;
          }[];
          const p = projects.find((x) => x.name === 'Exam prep');
          return p ? tasks.filter((t) => t.projectId === p.id).length : -1;
        }),
      )
      .toBe(5);

    await page.getByRole('tab', { name: 'Today', exact: true }).click();
    await expect(page.getByText('Study 25 minutes').first()).toBeVisible();
  });

  test('a Pro template on Free links to pricing', async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/');
    await page.getByRole('tab', { name: 'Projects', exact: true }).click();

    const moving = page.getByTestId('tpl-moving');
    await expect(moving.getByText('Moving house', { exact: true })).toBeVisible();
    await expect(moving.getByRole('button')).toHaveCount(0);
    await expect(moving.getByRole('link', { name: 'Unlock with Pro' })).toHaveAttribute(
      'href',
      '/pricing',
    );
  });
});
