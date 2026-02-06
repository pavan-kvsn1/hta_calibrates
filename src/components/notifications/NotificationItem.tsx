'use client'

import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'

// Icons for notification types
const notificationIcons: Record<string, string> = {
  REVISION_REQUESTED: '📝',
  CERTIFICATE_APPROVED: '✅',
  SENT_TO_CUSTOMER: '📤',
  CERTIFICATE_FINALIZED: '🎉',
  SUBMITTED_FOR_REVIEW: '📋',
  ENGINEER_RESPONDED: '💬',
  CUSTOMER_REVISION_REQUEST: '🔄',
  CUSTOMER_APPROVED: '👍',
  CERTIFICATE_READY: '📩',
  HOD_REPLIED: '💬',
}

// Navigation paths for notification types
const getNavigationPath = (type: string, certificateId: string | null, userRole: string): string | null => {
  if (!certificateId) return null

  // Customer notifications
  if (userRole === 'CUSTOMER') {
    return `/customer/review/cert/${certificateId}`
  }

  // HoD notifications
  if (userRole === 'HOD') {
    switch (type) {
      case 'SUBMITTED_FOR_REVIEW':
      case 'ENGINEER_RESPONDED':
      case 'CUSTOMER_REVISION_REQUEST':
      case 'CUSTOMER_APPROVED':
        return `/hod/review/${certificateId}`
      default:
        return `/certificates/${certificateId}`
    }
  }

  // Engineer notifications
  switch (type) {
    case 'REVISION_REQUESTED':
    case 'CERTIFICATE_APPROVED':
    case 'SENT_TO_CUSTOMER':
    case 'CERTIFICATE_FINALIZED':
      return `/certificates/${certificateId}`
    default:
      return `/certificates/${certificateId}`
  }
}

interface NotificationItemProps {
  notification: {
    id: string
    type: string
    title: string
    message: string
    read: boolean
    createdAt: string
    certificate: {
      id: string
      certificateNumber: string
      status: string
    } | null
  }
  userRole: string
  onMarkAsRead?: (id: string) => void
  compact?: boolean
}

export function NotificationItem({ notification, userRole, onMarkAsRead, compact = false }: NotificationItemProps) {
  const router = useRouter()
  const icon = notificationIcons[notification.type] || '🔔'
  const navigationPath = getNavigationPath(notification.type, notification.certificate?.id || null, userRole)

  const handleClick = () => {
    if (onMarkAsRead && !notification.read) {
      onMarkAsRead(notification.id)
    }
    if (navigationPath) {
      router.push(navigationPath)
    }
  }

  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })

  if (compact) {
    return (
      <button
        onClick={handleClick}
        className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
          !notification.read ? 'bg-blue-50/50' : ''
        }`}
      >
        <div className="flex items-start gap-2">
          {!notification.read && (
            <span className="w-2 h-2 mt-1.5 bg-blue-500 rounded-full flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{icon}</span>
              <span className={`text-sm truncate ${!notification.read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                {notification.title}
              </span>
            </div>
            <p className="text-xs text-gray-500 truncate mt-0.5">{notification.message}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo}</p>
          </div>
        </div>
      </button>
    )
  }

  return (
    <div
      onClick={handleClick}
      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
        !notification.read
          ? 'bg-blue-50 border-blue-200 hover:bg-blue-100'
          : 'bg-white border-gray-200 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {!notification.read && (
              <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
            )}
            <h4 className={`text-sm ${!notification.read ? 'font-semibold' : 'font-medium'} text-gray-900`}>
              {notification.title}
            </h4>
          </div>
          <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
          {notification.certificate && (
            <p className="text-xs text-gray-500 mt-1">
              {notification.certificate.certificateNumber}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-2">{timeAgo}</p>
        </div>
      </div>
    </div>
  )
}
