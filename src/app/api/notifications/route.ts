import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getNotifications } from '@/lib/services/notifications'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    const isCustomer = session.user.role === 'CUSTOMER'

    const result = await getNotifications({
      userId: isCustomer ? undefined : session.user.id,
      customerId: isCustomer ? session.user.id : undefined,
      limit,
      offset,
      unreadOnly,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}
