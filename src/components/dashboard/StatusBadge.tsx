import { cn } from '@/lib/utils'

type CertificateStatus =
  | 'DRAFT'
  | 'PENDING_HOD_REVIEW'
  | 'REVISION_REQUIRED'
  | 'PENDING_CUSTOMER_APPROVAL'
  | 'CUSTOMER_REVISION_REQUIRED'
  | 'APPROVED'
  | 'REJECTED'

interface StatusBadgeProps {
  status: CertificateStatus | string
  className?: string
}

const statusConfig: Record<
  CertificateStatus,
  { label: string; bgColor: string; textColor: string }
> = {
  DRAFT: {
    label: 'Draft',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
  },
  PENDING_HOD_REVIEW: {
    label: 'Pending HoD Review',
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
  const config = statusConfig[status as CertificateStatus] || {
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
