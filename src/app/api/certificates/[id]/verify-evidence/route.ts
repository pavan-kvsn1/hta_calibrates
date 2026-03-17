import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { verifyEvidenceChain } from '@/lib/stores/signing-evidence'

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET - Verify signing evidence chain integrity
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only Admin can verify evidence
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params

    const result = await verifyEvidenceChain(id)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error verifying evidence chain:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
