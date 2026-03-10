/**
 * Feature Flags
 *
 * Centralized feature flag management for gradual rollout of new features.
 * All flags default to false if not set in environment.
 *
 * Environment Variables:
 * - FEATURE_NEW_WORKFLOW: Enable peer-based review workflow
 * - FEATURE_CHAT: Enable chat messaging system
 * - FEATURE_TAT: Enable TAT (Turn Around Time) tracking
 * - FEATURE_UUC_IMAGES: Enable UUC reading image uploads
 */

export type FeatureFlag =
  | 'NEW_WORKFLOW'
  | 'CHAT'
  | 'TAT'
  | 'UUC_IMAGES'

/**
 * Check if a feature flag is enabled
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  const envVar = `FEATURE_${flag}`
  return process.env[envVar] === 'true'
}

/**
 * Get all feature flags and their current status
 */
export function getAllFeatureFlags(): Record<FeatureFlag, boolean> {
  return {
    NEW_WORKFLOW: isFeatureEnabled('NEW_WORKFLOW'),
    CHAT: isFeatureEnabled('CHAT'),
    TAT: isFeatureEnabled('TAT'),
    UUC_IMAGES: isFeatureEnabled('UUC_IMAGES'),
  }
}

// Convenience exports for common checks

/**
 * Check if the new peer-based review workflow is enabled
 */
export function isNewWorkflowEnabled(): boolean {
  return isFeatureEnabled('NEW_WORKFLOW')
}

/**
 * Check if the chat messaging system is enabled
 */
export function isChatEnabled(): boolean {
  return isFeatureEnabled('CHAT')
}

/**
 * Check if TAT tracking is enabled
 */
export function isTATEnabled(): boolean {
  return isFeatureEnabled('TAT')
}

/**
 * Check if UUC image uploads are enabled
 */
export function isUUCImagesEnabled(): boolean {
  return isFeatureEnabled('UUC_IMAGES')
}

/**
 * Check if a feature is gated and return appropriate message
 * Usage in server components:
 *
 * ```tsx
 * export default async function Page() {
 *   if (!isFeatureEnabled('CHAT')) {
 *     return <div>{getFeatureGateMessage('Chat')}</div>
 *   }
 *   return <ChatComponent />
 * }
 * ```
 */
export function getFeatureGateMessage(feature: string): string {
  return `${feature} is not available yet.`
}

/**
 * Get feature flag value for client-side usage
 * Call this from server components and pass to client components
 */
export function getClientFeatureFlags(): Record<FeatureFlag, boolean> {
  return getAllFeatureFlags()
}
