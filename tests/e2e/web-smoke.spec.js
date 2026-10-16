import { test, expect } from '@playwright/test';

test.describe('Vexora Web App - Smoke Test', () => {
  test('Landing page loads with brand header and core pillars', async ({ page }) => {
    await page.goto('/');

    // Verify title and main heading
    await expect(page).toHaveTitle(/Vexora Esports/i);
    const heroTitle = page.locator('#hero-title');
    await expect(heroTitle).toBeVisible();
    await expect(heroTitle).toContainText('VEXORA ESPORTS');

    // Verify the three trust architecture cards
    const cardTournaments = page.locator('#card-tournaments');
    await expect(cardTournaments).toBeVisible();
    await expect(cardTournaments).toContainText('Verified Tournaments');

    const cardAdjudication = page.locator('#card-adjudication');
    await expect(cardAdjudication).toBeVisible();
    await expect(cardAdjudication).toContainText('Transparent Adjudication');

    const cardLedger = page.locator('#card-ledger');
    await expect(cardLedger).toBeVisible();
    await expect(cardLedger).toContainText('Double-Entry Ledger');
  });

  test('Health check endpoint returns healthy status', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.service).toBe('vexora-web');
  });
});
