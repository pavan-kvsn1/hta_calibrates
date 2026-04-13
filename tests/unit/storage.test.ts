/**
 * Storage Unit Tests
 *
 * Tests for storage helpers, utilities, and providers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getStorageConfig,
  getImageStorageConfig,
  assetNumberToFileName,
  fileNameToAssetNumber,
  generateImageStorageKey,
  parseImageStorageKey,
  getImageVariantKeys,
  getStorageProvider,
  getImageStorageProvider,
  resetStorageProvider,
  resetImageStorageProvider,
  getMasterInstrumentCertificateStorage,
} from '@/lib/storage'

describe('Storage', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('getStorageConfig', () => {
    it('should return local config by default', () => {
      delete process.env.CERTIFICATE_STORAGE_TYPE
      delete process.env.GCS_CERTIFICATES_BUCKET

      const config = getStorageConfig()

      expect(config.type).toBe('local')
      expect(config.localPath).toBe('./storage/master-instrument-certificates')
    })

    it('should return GCS config when configured', () => {
      process.env.CERTIFICATE_STORAGE_TYPE = 'gcs'
      process.env.GCS_CERTIFICATES_BUCKET = 'my-bucket'
      process.env.GCP_PROJECT_ID = 'my-project'

      const config = getStorageConfig()

      expect(config.type).toBe('gcs')
      expect(config.gcsBucket).toBe('my-bucket')
      expect(config.gcsProjectId).toBe('my-project')
    })

    it('should use custom local path when configured', () => {
      process.env.CERTIFICATE_STORAGE_TYPE = 'local'
      process.env.CERTIFICATE_STORAGE_PATH = '/custom/path'

      const config = getStorageConfig()

      expect(config.type).toBe('local')
      expect(config.localPath).toBe('/custom/path')
    })
  })

  describe('getImageStorageConfig', () => {
    it('should default to certificate storage type', () => {
      delete process.env.IMAGE_STORAGE_TYPE
      process.env.CERTIFICATE_STORAGE_TYPE = 'gcs'
      process.env.GCS_CERTIFICATES_BUCKET = 'cert-bucket'

      const config = getImageStorageConfig()

      expect(config.type).toBe('gcs')
      expect(config.gcsBucket).toBe('cert-bucket')
    })

    it('should use dedicated image storage when configured', () => {
      process.env.IMAGE_STORAGE_TYPE = 'gcs'
      process.env.GCS_IMAGES_BUCKET = 'images-bucket'

      const config = getImageStorageConfig()

      expect(config.type).toBe('gcs')
      expect(config.gcsBucket).toBe('images-bucket')
    })

    it('should return local image storage config', () => {
      delete process.env.IMAGE_STORAGE_TYPE
      delete process.env.CERTIFICATE_STORAGE_TYPE

      const config = getImageStorageConfig()

      expect(config.type).toBe('local')
      expect(config.localPath).toBe('./storage/certificate-images')
    })
  })

  describe('assetNumberToFileName', () => {
    it('should convert asset number to safe filename', () => {
      expect(assetNumberToFileName('149 HTAIPL/L')).toBe('149 HTAIPL L.pdf')
    })

    it('should handle asset number without slash', () => {
      expect(assetNumberToFileName('ABC123')).toBe('ABC123.pdf')
    })

    it('should handle multiple slashes', () => {
      expect(assetNumberToFileName('A/B/C')).toBe('A B C.pdf')
    })

    it('should preserve other special characters', () => {
      expect(assetNumberToFileName('TEST-001_v2')).toBe('TEST-001_v2.pdf')
    })
  })

  describe('fileNameToAssetNumber', () => {
    it('should remove .pdf extension', () => {
      expect(fileNameToAssetNumber('149 HTAIPL L.pdf')).toBe('149 HTAIPL L')
    })

    it('should handle uppercase extension', () => {
      expect(fileNameToAssetNumber('ABC123.PDF')).toBe('ABC123')
    })

    it('should handle file without extension', () => {
      expect(fileNameToAssetNumber('ABC123')).toBe('ABC123')
    })
  })

  describe('generateImageStorageKey', () => {
    it('should generate UUC image key', () => {
      const key = generateImageStorageKey(
        {
          certificateId: 'cert-123',
          imageType: 'UUC',
        },
        'photo.jpg'
      )

      expect(key).toMatch(/^certificates\/cert-123\/uuc\/\d+-\w+\.jpg$/)
    })

    it('should generate master instrument image key', () => {
      const key = generateImageStorageKey(
        {
          certificateId: 'cert-123',
          imageType: 'MASTER_INSTRUMENT',
          masterInstrumentIndex: 2,
        },
        'master.png'
      )

      expect(key).toMatch(/^certificates\/cert-123\/master\/2\/\d+-\w+\.png$/)
    })

    it('should generate reading UUC image key', () => {
      const key = generateImageStorageKey(
        {
          certificateId: 'cert-123',
          imageType: 'READING_UUC',
          parameterIndex: 1,
          pointNumber: 3,
        },
        'reading.jpg'
      )

      expect(key).toMatch(
        /^certificates\/cert-123\/readings\/param-1\/point-3\/uuc\/\d+-\w+\.jpg$/
      )
    })

    it('should generate reading master image key', () => {
      const key = generateImageStorageKey(
        {
          certificateId: 'cert-123',
          imageType: 'READING_MASTER',
          parameterIndex: 0,
          pointNumber: 1,
        },
        'reading.jpg'
      )

      expect(key).toMatch(
        /^certificates\/cert-123\/readings\/param-0\/point-1\/master\/\d+-\w+\.jpg$/
      )
    })

    it('should include version suffix for versions > 1', () => {
      const key = generateImageStorageKey(
        {
          certificateId: 'cert-123',
          imageType: 'UUC',
          version: 2,
        },
        'photo.jpg'
      )

      expect(key).toContain('-v2.')
    })

    it('should generate optimized variant key', () => {
      const key = generateImageStorageKey(
        {
          certificateId: 'cert-123',
          imageType: 'UUC',
        },
        'photo.png',
        'optimized'
      )

      expect(key).toMatch(/-optimized\.jpg$/)
    })

    it('should generate thumbnail variant key', () => {
      const key = generateImageStorageKey(
        {
          certificateId: 'cert-123',
          imageType: 'UUC',
        },
        'photo.png',
        'thumbnail'
      )

      expect(key).toMatch(/-thumbnail\.jpg$/)
    })
  })

  describe('parseImageStorageKey', () => {
    it('should parse UUC image key', () => {
      const result = parseImageStorageKey('certificates/cert-123/uuc/1700000000-abc123.jpg')

      expect(result.certificateId).toBe('cert-123')
      expect(result.imageType).toBe('UUC')
      expect(result.timestamp).toBe(1700000000)
      expect(result.variant).toBe('original')
    })

    it('should parse master instrument image key', () => {
      const result = parseImageStorageKey('certificates/cert-456/master/2/1700000000-xyz.jpg')

      expect(result.certificateId).toBe('cert-456')
      expect(result.imageType).toBe('MASTER_INSTRUMENT')
      expect(result.masterInstrumentIndex).toBe(2)
    })

    it('should parse reading UUC image key', () => {
      const result = parseImageStorageKey(
        'certificates/cert-789/readings/param-1/point-3/uuc/1700000000-abc.jpg'
      )

      expect(result.imageType).toBe('READING_UUC')
      expect(result.parameterIndex).toBe(1)
      expect(result.pointNumber).toBe(3)
    })

    it('should parse reading master image key', () => {
      const result = parseImageStorageKey(
        'certificates/cert-789/readings/param-0/point-2/master/1700000000-xyz.jpg'
      )

      expect(result.imageType).toBe('READING_MASTER')
      expect(result.parameterIndex).toBe(0)
      expect(result.pointNumber).toBe(2)
    })

    it('should detect optimized variant', () => {
      const result = parseImageStorageKey(
        'certificates/cert-123/uuc/1700000000-abc-optimized.jpg'
      )

      expect(result.variant).toBe('optimized')
    })

    it('should detect thumbnail variant', () => {
      const result = parseImageStorageKey(
        'certificates/cert-123/uuc/1700000000-abc-thumbnail.jpg'
      )

      expect(result.variant).toBe('thumbnail')
    })

    it('should return empty object for invalid key', () => {
      const result = parseImageStorageKey('invalid/path')
      expect(result).toEqual({})
    })

    it('should return empty object for non-certificate path', () => {
      const result = parseImageStorageKey('other/cert-123/uuc/file.jpg')
      expect(result).toEqual({})
    })
  })

  describe('getImageVariantKeys', () => {
    it('should return all variant keys', () => {
      const originalKey = 'certificates/cert-123/uuc/1700000000-abc.jpg'
      const variants = getImageVariantKeys(originalKey)

      expect(variants.original).toBe(originalKey)
      expect(variants.optimized).toBe('certificates/cert-123/uuc/1700000000-abc-optimized.jpg')
      expect(variants.thumbnail).toBe('certificates/cert-123/uuc/1700000000-abc-thumbnail.jpg')
    })

    it('should handle different original extensions', () => {
      const variants = getImageVariantKeys('path/to/image.png')

      expect(variants.original).toBe('path/to/image.png')
      expect(variants.optimized).toBe('path/to/image-optimized.jpg')
      expect(variants.thumbnail).toBe('path/to/image-thumbnail.jpg')
    })
  })

  describe('getStorageProvider', () => {
    beforeEach(() => {
      resetStorageProvider()
    })

    it('should return a LocalStorageProvider by default', () => {
      delete process.env.CERTIFICATE_STORAGE_TYPE

      const provider = getStorageProvider()

      expect(provider).toBeDefined()
      expect(provider.upload).toBeDefined()
      expect(provider.download).toBeDefined()
    })

    it('should return same instance on subsequent calls (singleton)', () => {
      const provider1 = getStorageProvider()
      const provider2 = getStorageProvider()

      expect(provider1).toBe(provider2)
    })

    it('should throw error for GCS without bucket configured', () => {
      process.env.CERTIFICATE_STORAGE_TYPE = 'gcs'
      delete process.env.GCS_CERTIFICATES_BUCKET

      expect(() => getStorageProvider()).toThrow('GCS_CERTIFICATES_BUCKET environment variable is required')
    })
  })

  describe('getImageStorageProvider', () => {
    beforeEach(() => {
      resetImageStorageProvider()
    })

    it('should return a LocalStorageProvider by default', () => {
      delete process.env.IMAGE_STORAGE_TYPE
      delete process.env.CERTIFICATE_STORAGE_TYPE

      const provider = getImageStorageProvider()

      expect(provider).toBeDefined()
    })

    it('should return same instance on subsequent calls (singleton)', () => {
      const provider1 = getImageStorageProvider()
      const provider2 = getImageStorageProvider()

      expect(provider1).toBe(provider2)
    })

    it('should throw error for GCS without bucket configured', () => {
      process.env.IMAGE_STORAGE_TYPE = 'gcs'
      delete process.env.GCS_IMAGES_BUCKET
      delete process.env.GCS_CERTIFICATES_BUCKET

      expect(() => getImageStorageProvider()).toThrow('GCS_IMAGES_BUCKET environment variable is required')
    })
  })

  describe('getMasterInstrumentCertificateStorage', () => {
    beforeEach(() => {
      resetStorageProvider()
    })

    it('should return the storage provider', () => {
      delete process.env.CERTIFICATE_STORAGE_TYPE

      const provider = getMasterInstrumentCertificateStorage()

      expect(provider).toBeDefined()
    })
  })

  describe('resetStorageProvider', () => {
    it('should reset the singleton', () => {
      delete process.env.CERTIFICATE_STORAGE_TYPE

      const provider1 = getStorageProvider()
      resetStorageProvider()
      const provider2 = getStorageProvider()

      // After reset, a new instance should be created
      expect(provider1).not.toBe(provider2)
    })
  })

  describe('resetImageStorageProvider', () => {
    it('should reset the image storage singleton', () => {
      delete process.env.IMAGE_STORAGE_TYPE
      delete process.env.CERTIFICATE_STORAGE_TYPE

      const provider1 = getImageStorageProvider()
      resetImageStorageProvider()
      const provider2 = getImageStorageProvider()

      expect(provider1).not.toBe(provider2)
    })
  })
})

// Test LocalStorageProvider directly
describe('LocalStorageProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStorageProvider()
    delete process.env.CERTIFICATE_STORAGE_TYPE
  })

  describe('getSignedUrl', () => {
    it('should return API route path', async () => {
      const provider = getStorageProvider()

      const result = await provider.getSignedUrl('test/file.pdf')

      expect(result).toContain('/api/storage/download')
      expect(result).toContain('path=')
    })

    it('should encode file path with special characters', async () => {
      const provider = getStorageProvider()

      const result = await provider.getSignedUrl('test/file with spaces.pdf')

      expect(result).toContain(encodeURIComponent('test/file with spaces.pdf'))
    })
  })

  describe('upload', () => {
    it('should upload file and return path', async () => {
      const provider = getStorageProvider()
      const buffer = Buffer.from('test content')

      const result = await provider.upload('test/file.pdf', buffer)

      expect(result).toBe('test/file.pdf')
    })
  })

  describe('exists', () => {
    it('should check if file exists', async () => {
      const provider = getStorageProvider()

      // This will actually check the file system, but we're testing the method exists
      const result = await provider.exists('non-existent-file-12345.pdf')

      expect(typeof result).toBe('boolean')
    })
  })

  describe('download', () => {
    it('should download uploaded file', async () => {
      const provider = getStorageProvider()
      const buffer = Buffer.from('download test content')
      const testPath = 'test-download/file.txt'

      // Upload first
      await provider.upload(testPath, buffer)

      // Then download
      const result = await provider.download(testPath)

      expect(result.toString()).toBe('download test content')

      // Clean up
      await provider.delete(testPath)
    })

    it('should throw error for non-existent file', async () => {
      const provider = getStorageProvider()

      await expect(provider.download('absolutely-non-existent-file-xyz.pdf')).rejects.toThrow('File not found')
    })
  })

  describe('delete', () => {
    it('should delete uploaded file', async () => {
      const provider = getStorageProvider()
      const buffer = Buffer.from('delete test content')
      const testPath = 'test-delete/file.txt'

      // Upload first
      await provider.upload(testPath, buffer)

      // Verify it exists
      expect(await provider.exists(testPath)).toBe(true)

      // Delete
      await provider.delete(testPath)

      // Verify it's gone
      expect(await provider.exists(testPath)).toBe(false)
    })
  })

  describe('list', () => {
    it('should list files in directory', async () => {
      const provider = getStorageProvider()
      const buffer = Buffer.from('list test content')
      const testPath = 'test-list-dir/testfile.txt'

      // Upload file
      await provider.upload(testPath, buffer)

      // List files - the list function expects a prefix in the directory
      const files = await provider.list('test-list-dir/testfile')

      expect(files.length).toBeGreaterThanOrEqual(1)

      // Clean up
      await provider.delete(testPath)
    })

    it('should return empty array for non-existent directory', async () => {
      const provider = getStorageProvider()

      const files = await provider.list('non-existent-dir-xyz/')

      expect(files).toEqual([])
    })
  })

  describe('getMetadata', () => {
    it('should return metadata for existing file', async () => {
      const provider = getStorageProvider()
      const buffer = Buffer.from('metadata test content')
      const testPath = 'test-meta/file.pdf'

      // Upload first
      await provider.upload(testPath, buffer)

      // Get metadata
      const metadata = await provider.getMetadata(testPath)

      expect(metadata).not.toBeNull()
      expect(metadata?.path).toBe(testPath)
      expect(metadata?.size).toBe(buffer.length)
      expect(metadata?.contentType).toBe('application/pdf')

      // Clean up
      await provider.delete(testPath)
    })

    it('should return null for non-existent file', async () => {
      const provider = getStorageProvider()

      const metadata = await provider.getMetadata('non-existent-file-xyz.pdf')

      expect(metadata).toBeNull()
    })
  })
})

// Test GCSStorageProvider with mocked module
describe('GCSStorageProvider', () => {
  // Define mock objects at module level
  const mockFile = {
    save: vi.fn().mockResolvedValue(undefined),
    download: vi.fn().mockResolvedValue([Buffer.from('test content')]),
    delete: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue([true]),
    getSignedUrl: vi.fn().mockResolvedValue(['https://signed-url.example.com']),
    getMetadata: vi.fn().mockResolvedValue([{
      size: '1024',
      contentType: 'application/pdf',
      updated: '2024-01-01T00:00:00Z',
    }]),
  }

  const mockBucket = {
    file: vi.fn().mockReturnValue(mockFile),
    getFiles: vi.fn().mockResolvedValue([[
      { name: 'file1.pdf', metadata: { size: '1024', contentType: 'application/pdf', updated: '2024-01-01' } },
      { name: 'file2.pdf', metadata: { size: '2048', contentType: 'application/pdf', updated: '2024-01-02' } },
    ]]),
  }

  // Mock the Storage class as a constructor function
  vi.mock('@google-cloud/storage', () => {
    return {
      Storage: class MockStorage {
        bucket() {
          return {
            file: () => ({
              save: vi.fn().mockResolvedValue(undefined),
              download: vi.fn().mockResolvedValue([Buffer.from('test content')]),
              delete: vi.fn().mockResolvedValue(undefined),
              exists: vi.fn().mockResolvedValue([true]),
              getSignedUrl: vi.fn().mockResolvedValue(['https://signed-url.example.com']),
              getMetadata: vi.fn().mockResolvedValue([{
                size: '1024',
                contentType: 'application/pdf',
                updated: '2024-01-01T00:00:00Z',
              }]),
            }),
            getFiles: vi.fn().mockResolvedValue([[
              { name: 'file1.pdf', metadata: { size: '1024', contentType: 'application/pdf', updated: '2024-01-01' } },
              { name: 'file2.pdf', metadata: { size: '2048', contentType: 'application/pdf', updated: '2024-01-02' } },
            ]]),
          }
        }
      },
    }
  })

  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    resetStorageProvider()
    process.env = { ...originalEnv }
    process.env.CERTIFICATE_STORAGE_TYPE = 'gcs'
    process.env.GCS_CERTIFICATES_BUCKET = 'test-bucket'
    process.env.GCP_PROJECT_ID = 'test-project'
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('upload', () => {
    it('should upload file to GCS and return path', async () => {
      const { GCSStorageProvider } = await import('@/lib/storage/gcs-storage')
      const provider = new GCSStorageProvider('test-bucket', 'test-project')
      const buffer = Buffer.from('test content')

      const result = await provider.upload('test/file.pdf', buffer)

      expect(result).toBe('test/file.pdf')
    })

    it('should accept content type option', async () => {
      const { GCSStorageProvider } = await import('@/lib/storage/gcs-storage')
      const provider = new GCSStorageProvider('test-bucket', 'test-project')
      const buffer = Buffer.from('test content')

      const result = await provider.upload('test/file.pdf', buffer, { contentType: 'application/pdf' })

      expect(result).toBe('test/file.pdf')
    })
  })

  describe('download', () => {
    it('should download file from GCS', async () => {
      const { GCSStorageProvider } = await import('@/lib/storage/gcs-storage')
      const provider = new GCSStorageProvider('test-bucket', 'test-project')

      const result = await provider.download('test/file.pdf')

      expect(result).toBeInstanceOf(Buffer)
    })
  })

  describe('exists', () => {
    it('should check if file exists', async () => {
      const { GCSStorageProvider } = await import('@/lib/storage/gcs-storage')
      const provider = new GCSStorageProvider('test-bucket', 'test-project')

      const result = await provider.exists('test/file.pdf')

      expect(typeof result).toBe('boolean')
    })
  })

  describe('getSignedUrl', () => {
    it('should return signed URL', async () => {
      const { GCSStorageProvider } = await import('@/lib/storage/gcs-storage')
      const provider = new GCSStorageProvider('test-bucket', 'test-project')

      const result = await provider.getSignedUrl('test/file.pdf')

      expect(result).toBe('https://signed-url.example.com')
    })

    it('should accept expiration options', async () => {
      const { GCSStorageProvider } = await import('@/lib/storage/gcs-storage')
      const provider = new GCSStorageProvider('test-bucket', 'test-project')

      const result = await provider.getSignedUrl('test/file.pdf', { expiresInMinutes: 30 })

      expect(typeof result).toBe('string')
    })

    it('should accept action option', async () => {
      const { GCSStorageProvider } = await import('@/lib/storage/gcs-storage')
      const provider = new GCSStorageProvider('test-bucket', 'test-project')

      const result = await provider.getSignedUrl('test/file.pdf', { action: 'write' })

      expect(typeof result).toBe('string')
    })
  })

  describe('list', () => {
    it('should list files with prefix', async () => {
      const { GCSStorageProvider } = await import('@/lib/storage/gcs-storage')
      const provider = new GCSStorageProvider('test-bucket', 'test-project')

      const result = await provider.list('certificates/')

      expect(result).toHaveLength(2)
      expect(result[0].path).toBe('file1.pdf')
    })
  })

  describe('getMetadata', () => {
    it('should return file metadata', async () => {
      const { GCSStorageProvider } = await import('@/lib/storage/gcs-storage')
      const provider = new GCSStorageProvider('test-bucket', 'test-project')

      const result = await provider.getMetadata('test/file.pdf')

      expect(result).toBeDefined()
      expect(result?.size).toBe(1024)
    })
  })

  describe('delete', () => {
    it('should delete file from GCS', async () => {
      const { GCSStorageProvider } = await import('@/lib/storage/gcs-storage')
      const provider = new GCSStorageProvider('test-bucket', 'test-project')

      // Should complete without throwing
      await provider.delete('test/file.pdf')
      expect(true).toBe(true)
    })
  })
})
