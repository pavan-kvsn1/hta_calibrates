import { cn } from '@/lib/utils'

type CertificateStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'PENDING_HOD_REVIEW' // Legacy - maps to PENDING_REVIEW
  | 'REVISION_REQUIRED'
  | 'PENDING_CUSTOMER_APPROVAL'
  | 'CUSTOMER_REVISION_REQUIRED'
  | 'PENDING_ADMIN_AUTHORIZATION'
  | 'AUTHORIZED'
  | 'APPROVED'
  | 'REJECTED'

interface StatusBadgeProps {
  status: CertificateStatus | string
  className?: string
}

// Map legacy statuses to new ones
const statusAliases: Record<string, string> = {
  PENDING_HOD_REVIEW: 'PENDING_REVIEW',
  HOD_REVISION_REQUIRED: 'REVISION_REQUIRED',
}

const statusConfig: Record<
  string,
  { label: string; bgColor: string; textColor: string }
> = {
  DRAFT: {
    label: 'Draft',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
  },
  PENDING_REVIEW: {
    label: 'Pending Review',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
  },
  REVISION_REQUIRED: {
    label: 'Revision Required',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-800',
  },
  PENDING_CUSTOMER_APPROVAL: {
    label: 'Pending Customer',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
  },
  CUSTOMER_REVISION_REQUIRED: {
    label: 'Customer Revision',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-800',
  },
  PENDING_ADMIN_AUTHORIZATION: {
    label: 'Pending Authorization',
    bgColor: 'bg-indigo-100',
    textColor: 'text-indigo-800',
  },
  AUTHORIZED: {
    label: 'Authorized',
    bgColor: 'bg-emerald-100',
    textColor: 'text-emerald-800',
  },
  APPROVED: {
    label: 'Approved',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
  },
  REJECTED: {
    label: 'Rejected',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
  },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  // Map legacy statuses to new ones
  const normalizedStatus = statusAliases[status] || status

  const config = statusConfig[normalizedStatus] || {
    label: status,
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.bgColor,
        config.textColor,
        className
      )}
    >
      {config.label}
    </span>
  )
}

// Export helper functions for status handling
export function normalizeStatus(status: string): string {
  return statusAliases[status] || status
}

export function getStatusLabel(status: string): string {
  const normalizedStatus = normalizeStatus(status)
  return statusConfig[normalizedStatus]?.label || status
}

export type { CertificateStatus }
