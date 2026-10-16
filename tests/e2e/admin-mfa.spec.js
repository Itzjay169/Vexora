import { test, expect } from '@playwright/test';

test.describe('Phase 9: Admin Console Shell with Mandatory MFA', () => {
  test('Admin Login enforces mandatory MFA and blocks invalid codes', async ({ page }) => {
    await page.goto('/admin/login');

    // 1. Verify Login Page Shell & Zero-Trust Notice
    await expect(page.locator('#admin-login-title')).toContainText('VEXORA ADMIN');
    await expect(page.locator('#mfa-enforced-badge')).toBeVisible();
    await expect(page.locator('#mfa-enforced-badge')).toContainText('Mandatory MFA Enforced');

    // Step 1: Submit administrative credentials
    await page.fill('#input-identifier', 'admin@vexora.gg');
    await page.fill('#input-password', 'correctAdminPassword123');
    await page.click('#btn-proceed-mfa');

    // Step 2: MFA prompt MUST appear
    await expect(page.locator('#step-mfa')).toBeVisible();
    await expect(page.locator('#mfa-prompt-text')).toContainText('Enter 6-digit TOTP code');

    // Security Gate: Test that entering an invalid MFA code is blocked
    await page.fill('#input-mfa-code', '000000');
    await page.click('#btn-verify-mfa');

    const errorBanner = page.locator('#login-error');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText('Invalid MFA verification code');

    // Enter valid 6-digit MFA code and verify successful access
    await page.fill('#input-mfa-code', '123456');
    await page.click('#btn-verify-mfa');

    // 3. Navigation to Admin Console
    await page.waitForURL('**/admin');
    await expect(page.locator('#brand-title')).toContainText('VEXORA ADMIN');
    await expect(page.locator('#brand-subtitle')).toContainText('Zero-Trust Console');
    await expect(page.locator('#badge-audit-chain-valid')).toContainText('Audit Chain Valid');

    // Verify presence of role navigation links
    await expect(page.locator('#nav-overview')).toBeVisible();
    await expect(page.locator('#nav-maker-checker')).toBeVisible();
    await expect(page.locator('#nav-audit')).toBeVisible();
  });

  test('Admin Console overview implements Maker-Checker and Audit Chain status', async ({ page }) => {
    await page.goto('/admin');

    await expect(page.locator('#page-title')).toContainText('System Health & Moderation Overview');
    await expect(page.locator('#maker-checker-panel')).toContainText('Financial Maker-Checker Queue');
    await expect(page.locator('#security-panel')).toContainText('Zero-Trust Controls');
    await expect(page.locator('#security-panel')).toContainText('Mandatory Admin MFA Active');
  });
});
