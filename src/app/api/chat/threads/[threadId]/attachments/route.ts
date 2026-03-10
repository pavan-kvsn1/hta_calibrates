/**
 * Chat Attachments Upload API
 *
 * POST /api/chat/threads/[threadId]/attachments - Upload files for chat
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, canAccessChatThread } from '@/lib/auth'
import { getThreadWithCertificate } from '@/lib/services/chat'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

// Storage directory for chat attachments
const UPLOAD_DIR = join(process.cwd(), 'uploads', 'chat-attachments')

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024

// Allowed file types
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
]

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true })
  } catch {
    // Directory already exists
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { threadId } = await params

    // Get thread with certificate for access check
    const threadData = await getThreadWithCertificate(threadId)

    if (!threadData) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    // Check access
    const hasAccess = canAccessChatThread(
      { id: session.user.id, role: session.user.role || 'ENGINEER' },
      { createdById: threadData.certificate.createdById, reviewerId: threadData.certificate.reviewerId },
      threadData.threadType as 'ASSIGNEE_REVIEWER' | 'REVIEWER_CUSTOMER'
    )

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Ensure upload directory exists
    await ensureUploadDir()

    // Parse form data
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    // Limit number of files per upload
    if (files.length > 5) {
      return NextResponse.json(
        { error: 'Maximum 5 files per upload' },
        { status: 400 }
      )
    }

    const uploadedFiles = []

    for (const file of files) {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        continue // Skip files that are too large
      }

      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        continue // Skip unsupported file types
      }

      // Generate unique filename
      const ext = file.name.split('.').pop() || 'bin'
      const uniqueFileName = `${threadId}-${randomUUID()}.${ext}`
      const filePath = join(UPLOAD_DIR, uniqueFileName)

      // Save file
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      await writeFile(filePath, buffer)

      uploadedFiles.push({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        storagePath: uniqueFileName,
      })
    }

    if (uploadedFiles.length === 0) {
      return NextResponse.json(
        { error: 'No valid files uploaded. Check file size (<10MB) and type.' },
        { status: 400 }
      )
    }

    return NextResponse.json({ files: uploadedFiles }, { status: 201 })
  } catch (error) {
    console.error('[Chat Attachments API] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to upload files' },
      { status: 500 }
    )
  }
}
