import { test, expect } from '@playwright/test';

test.describe('Vexora Design System - UI Kit Showcase', () => {
  test('UI Kit page renders design tokens, 11-state chips, and trust patterns', async ({ page }) => {
    await page.goto('/ui-kit');

    // Title & Header
    await expect(page).toHaveTitle(/Vexora Design System & UI Kit/i);
    const title = page.locator('#ui-kit-title');
    await expect(title).toBeVisible();
    await expect(title).toContainText('VEXORA DESIGN SYSTEM & UI KIT');

    // State Machine Chips
    await expect(page.locator('#chip-draft')).toBeVisible();
    await expect(page.locator('#chip-live')).toBeVisible();
    await expect(page.locator('#chip-disputed')).toBeVisible();
    await expect(page.locator('#chip-settled')).toBeVisible();

    // Trust UI Patterns
    await expect(page.locator('#badge-verified-sample')).toBeVisible();
    await expect(page.locator('#badge-evidence-hash-sample')).toBeVisible();
    await expect(page.locator('#badge-formula-sample')).toBeVisible();

    // Core Components
    await expect(page.locator('#component-tournament-card')).toBeVisible();
    await expect(page.locator('#component-bracket-node')).toBeVisible();
    await expect(page.locator('#component-ledger-row')).toBeVisible();
    await expect(page.locator('#component-dispute-card')).toBeVisible();

    // Theme Toggle Functionality
    const toggleBtn = page.locator('#theme-toggle-btn');
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();
    await expect(page.locator('body')).toHaveClass(/light-mode/);
  });
});
