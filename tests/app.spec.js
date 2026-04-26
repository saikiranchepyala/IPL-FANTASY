const { test, expect } = require('@playwright/test');

test('basic UI check', async ({ page }) => {
  await page.goto(`file://${process.cwd()}/ipl-fantasy-v4_render.html`);

  // Basic assertion, check title
  await expect(page).toHaveTitle(/IPL Fantasy League/);

  // Check the title of the app is visible
  await expect(page.locator('.hero-title-sm').first()).toBeVisible();

  // Initially, both buttons might be present, but depending on URL ?admin=1, different panels are visible
  // Let's verify admin panel
  const adminBtn = page.locator('.seg-btn[data-p="admin"]');
  await adminBtn.click();

  // admin login panel should be visible
  await expect(page.locator('#panel-admin')).toBeVisible();
  await expect(page.locator('#panel-member')).toBeHidden();

  // Verify member login panel
  const memberBtn = page.locator('.seg-btn[data-p="member"]');
  await memberBtn.click();

  // member login panel should be visible
  await expect(page.locator('#panel-member')).toBeVisible();
  await expect(page.locator('#panel-admin')).toBeHidden();
});

test('admin login check', async ({ page }) => {
  await page.goto(`file://${process.cwd()}/ipl-fantasy-v4_render.html`);

  // Wait for loading
  await expect(page.locator('.hero-title-sm').first()).toBeVisible();

  // Go to admin panel
  await page.locator('.seg-btn[data-p="admin"]').click();

  // Enter pin 1 6 1 7 into the .pd inputs
  const pinInputs = page.locator('.pd');
  await expect(pinInputs).toHaveCount(4);

  await pinInputs.nth(0).fill('1');
  await pinInputs.nth(1).fill('6');
  await pinInputs.nth(2).fill('1');
  await pinInputs.nth(3).fill('7');

  // Click login
  await page.locator('#adminLoginBtn').click();

  // Verify admin dashboard loads. Wait for the view-tabs containing "Current Match" which is admin-specific
  await expect(page.locator('.vtab', { hasText: 'Current Match' })).toBeVisible({ timeout: 10000 });
});
