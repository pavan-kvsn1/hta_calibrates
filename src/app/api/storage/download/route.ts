/**
 * Local Storage Download API Route
 *
 * GET /api/storage/download?path={encodedPath}
 *
 * This endpoint serves files from local storage for development.
 * In production, GCS signed URLs are used directly instead.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getImageStorageProvider, getImageStorageConfig } from '@/lib/storage'
import { createLogger } from '@/lib/logger'

const logger = createLogger('storage')

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get path from query
    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('path')

    if (!filePath) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 })
    }

    // Decode the path
    const decodedPath = decodeURIComponent(filePath)

    // Security: Ensure path doesn't contain directory traversal
    if (decodedPath.includes('..')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    // Only allow access to certificate images
    if (!decodedPath.startsWith('certificates/')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get storage provider
    const config = getImageStorageConfig()

    // Only serve files for local storage
    if (config.type !== 'local') {
      return NextResponse.json(
        { error: 'This endpoint is only for local development' },
        { status: 400 }
      )
    }

    const storage = getImageStorageProvider()

    // Check if file exists
    const exists = await storage.exists(decodedPath)
    if (!exists) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Download file
    const buffer = await storage.download(decodedPath)

    // Determine content type from extension
    const ext = decodedPath.split('.').pop()?.toLowerCase() || ''
    const contentTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'heic': 'image/heic',
      'heif': 'image/heif',
      'pdf': 'application/pdf',
    }
    const contentType = contentTypes[ext] || 'application/octet-stream'

    // Return file
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to download file from storage')
    return NextResponse.json(
      { error: 'Failed to download file' },
      { status: 500 }
    )
  }
}
