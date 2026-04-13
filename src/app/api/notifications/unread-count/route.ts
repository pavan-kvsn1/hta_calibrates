import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getUnreadCount } from '@/lib/services/notifications'
import { createLogger } from '@/lib/logger'

const logger = createLogger('notifications')

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const isCustomer = session.user.role === 'CUSTOMER'
    const isEngineer = session.user.role === 'ENGINEER'

    const count = await getUnreadCount({
      userId: isCustomer ? undefined : session.user.id,
      customerId: isCustomer ? session.user.id : undefined,
      // Engineers only count notifications for certificates they created or are reviewing
      filterByInvolvement: isEngineer,
    })

    return NextResponse.json({ count })
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch unread count')
    return NextResponse.json(
      { error: 'Failed to fetch unread count' },
      { status: 500 }
    )
  }
}
