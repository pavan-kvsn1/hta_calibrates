import { Page, expect } from '@playwright/test'
import { TEST_USERS } from './test-data'

type UserRole = keyof typeof TEST_USERS

interface LoginOptions {
  loginPath?: string
  expectedUrlPattern?: RegExp
}

/**
 * Robust login helper that handles network timing issues
 * This prevents flaky tests by properly waiting for all states
 */
export async function login(page: Page, role: UserRole, options: LoginOptions = {}) {
  const user = TEST_USERS[role]
  const loginPath = options.loginPath ?? '/login'
  const expectedUrlPattern = options.expectedUrlPattern ?? /dashboard|admin|customer/

  // Navigate and wait for login page to be fully loaded
  await page.goto(loginPath)
  await page.waitForLoadState('networkidle')

  // Wait for form elements to be ready
  const emailInput = page.locator('input[type="email"], input[name="email"]')
  const passwordInput = page.locator('input[type="password"], input[name="password"]')
  const submitButton = page.locator('button[type="submit"]')

  await emailInput.waitFor({ state: 'visible', timeout: 10000 })
  await passwordInput.waitFor({ state: 'visible', timeout: 10000 })

  // Fill credentials
  await emailInput.fill(user.email)
  await passwordInput.fill(user.password)

  // Click submit and wait for navigation simultaneously
  await Promise.all([
    page.waitForURL(expectedUrlPattern, { timeout: 30000 }),
    submitButton.click(),
  ])

  // Ensure the page is fully loaded after redirect
  await page.waitForLoadState('networkidle')
}

/**
 * Role-specific login helpers for convenience
 */
export async function loginAsEngineer(page: Page) {
  await login(page, 'engineer', { expectedUrlPattern: /dashboard/ })
  await expect(page).toHaveURL(/dashboard/)
}

export async function loginAsReviewer(page: Page) {
  await login(page, 'reviewer', { expectedUrlPattern: /dashboard|admin/ })
  await expect(page).toHaveURL(/dashboard|admin/)
}

export async function loginAsAdmin(page: Page) {
  await login(page, 'admin', { expectedUrlPattern: /admin|dashboard/ })
  await expect(page).toHaveURL(/admin|dashboard/)
}

export async function loginAsCustomer(page: Page) {
  await login(page, 'customer', {
    loginPath: '/customer/login',
    expectedUrlPattern: /customer\/dashboard/,
  })
  await expect(page).toHaveURL(/customer\/dashboard/)
}
