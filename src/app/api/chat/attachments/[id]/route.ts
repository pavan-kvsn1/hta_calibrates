/**
 * Chat Attachment File API
 *
 * GET /api/chat/attachments/[id] - Download/view a chat attachment
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { createLogger } from '@/lib/logger'

const logger = createLogger('chat')

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'chat-attachments')

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get attachment with message and thread info for access check
    const attachment = await prisma.chatAttachment.findUnique({
      where: { id },
      include: {
        message: {
          include: {
            thread: {
              include: {
                certificate: {
                  select: {
                    createdById: true,
                    reviewerId: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Check access: must be creator, reviewer, or admin
    const cert = attachment.message.thread.certificate
    const isCreator = cert.createdById === session.user.id
    const isReviewer = cert.reviewerId === session.user.id
    const isAdmin = session.user.role === 'ADMIN'

    if (!isCreator && !isReviewer && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Read file
    const filePath = join(UPLOAD_DIR, attachment.storagePath)
    const fileBuffer = await readFile(filePath)

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(attachment.fileName)}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to get chat attachment')
    return NextResponse.json(
      { error: 'Failed to get attachment' },
      { status: 500 }
    )
  }
}
