import { test, expect } from '@playwright/test'
import { TEST_USERS } from '../fixtures/test-data'

test.describe('Authentication', () => {
  test('should show login page', async ({ page }) => {
    await page.goto('/login')
    // Check for the login form with email and password fields
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('should reject invalid credentials', async ({ page }) => {
    await page.goto('/login')

    await page.fill('input[type="email"], input[name="email"]', 'invalid@test.com')
    await page.fill('input[type="password"], input[name="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    // Should show error or stay on login page
    await expect(page).toHaveURL(/login/)
  })

  test('engineer can login and see dashboard', async ({ page }) => {
    await page.goto('/login')

    await page.fill('input[type="email"], input[name="email"]', TEST_USERS.engineer.email)
    await page.fill('input[type="password"], input[name="password"]', TEST_USERS.engineer.password)
    await page.click('button[type="submit"]')

    // Should redirect to dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 })
  })

  test('Reviewer can login and see dashboard', async ({ page }) => {
    await page.goto('/login')

    await page.fill('input[type="email"], input[name="email"]', TEST_USERS.reviewer.email)
    await page.fill('input[type="password"], input[name="password"]', TEST_USERS.reviewer.password)
    await page.click('button[type="submit"]')

    // Should redirect to reviewer dashboard (may go to /admin for admin-level reviewers)
    await expect(page).toHaveURL(/admin|dashboard/, { timeout: 10000 })
  })

  test('protected routes redirect to login', async ({ page }) => {
    // Try to access dashboard without logging in
    await page.goto('/dashboard')

    // Should redirect to login
    await expect(page).toHaveURL(/login/)
  })
})
