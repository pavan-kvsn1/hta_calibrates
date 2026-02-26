import { test, expect } from '@playwright/test'
import { TEST_USERS } from '../fixtures/test-data'

test.describe('Authentication', () => {
  test('should show login page', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('h1, h2').first()).toContainText(/login|sign in/i)
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

  test('HoD can login and see dashboard', async ({ page }) => {
    await page.goto('/login')

    await page.fill('input[type="email"], input[name="email"]', TEST_USERS.hod.email)
    await page.fill('input[type="password"], input[name="password"]', TEST_USERS.hod.password)
    await page.click('button[type="submit"]')

    // Should redirect to HoD dashboard
    await expect(page).toHaveURL(/hod|dashboard/, { timeout: 10000 })
  })

  test('protected routes redirect to login', async ({ page }) => {
    // Try to access dashboard without logging in
    await page.goto('/dashboard')

    // Should redirect to login
    await expect(page).toHaveURL(/login/)
  })
})
