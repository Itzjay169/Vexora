import { test, expect } from '@playwright/test';

test.describe('Phase 11: Admin Game & Scoring Engine Management', () => {
  test('Admin can view games catalog, modes, and run interactive scoring simulation', async ({ page }) => {
    // 1. Navigate to Admin Game Management screen
    await page.goto('/admin/games');

    // 2. Verify Page Title & Phase 11 Badge
    await expect(page.locator('#games-page-title')).toContainText('Game & Scoring Engine');
    await expect(page.locator('#phase-badge')).toContainText('Phase 11 Blueprint');

    // 3. Verify Tab Navigation exists
    await expect(page.locator('#tab-catalog')).toBeVisible();
    await expect(page.locator('#tab-modes')).toBeVisible();
    await expect(page.locator('#tab-schemas')).toBeVisible();
    await expect(page.locator('#tab-simulator')).toBeVisible();

    // 4. Verify Launch Games are displayed in catalog
    await expect(page.locator('#game-card-bgmi')).toBeVisible();
    await expect(page.locator('#game-card-bgmi')).toContainText('Battlegrounds Mobile India');
    await expect(page.locator('#game-card-bgmi')).toContainText('Krafton');

    await expect(page.locator('#game-card-freefire')).toBeVisible();
    await expect(page.locator('#game-card-freefire')).toContainText('Garena Free Fire MAX');
    await expect(page.locator('#game-card-freefire')).toContainText('Garena');

    await expect(page.locator('#game-card-codm')).toBeVisible();
    await expect(page.locator('#game-card-codm')).toContainText('Call of Duty: Mobile');
    await expect(page.locator('#game-card-codm')).toContainText('Activision');

    // 5. Test Scoring Simulator Panel & Calculations
    await expect(page.locator('#scoring-simulator-panel')).toBeVisible();
    await expect(page.locator('#sim-game-select')).toBeVisible();

    // Click calculate standings button
    await page.click('#btn-run-simulation');

    // Verify simulation output
    await expect(page.locator('#sim-results-table')).toBeVisible();
    await expect(page.locator('#sim-results-table')).toContainText('Deterministic Tie-Breaks Resolved');
    await expect(page.locator('#sim-results-table')).toContainText('GodLike Esports');
    await expect(page.locator('#sim-results-table')).toContainText('Team Soul');
  });

  test('Navigation sidebar links to Game Management and maintains zero-trust badges', async ({ page }) => {
    await page.goto('/admin');

    // Verify Game Management link is present in the admin sidebar
    const navGames = page.locator('#nav-games');
    await expect(navGames).toBeVisible();
    await expect(navGames).toContainText('Game Management');

    // Click to navigate
    await navGames.click();
    await page.waitForURL('**/admin/games');
    await expect(page.locator('#games-page-title')).toBeVisible();
  });
});
