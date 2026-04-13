/**
 * Storage Unit Tests
 *
 * Tests for storage helpers and utilities
 * Note: Actual file I/O tests would be integration tests
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
})
