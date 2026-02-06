import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { markNotificationsAsRead } from '@/lib/notifications'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { notificationIds } = body

    const isCustomer = session.user.role === 'CUSTOMER'
    const markAll = notificationIds === 'all'

    await markNotificationsAsRead({
      notificationIds: markAll ? undefined : notificationIds,
      userId: isCustomer ? undefined : session.user.id,
      customerId: isCustomer ? session.user.id : undefined,
      markAll,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error marking notifications as read:', error)
    return NextResponse.json(
      { error: 'Failed to mark notifications as read' },
      { status: 500 }
    )
  }
}
