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
