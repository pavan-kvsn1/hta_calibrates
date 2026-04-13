/**
 * Image Processor Cloud Function
 *
 * Triggered when an image is uploaded to the certificate images bucket.
 * Creates optimized (JPEG 90%) and thumbnail (200x200) versions.
 *
 * Expected storage key format:
 * certificates/{certificateId}/{context}/{timestamp}-{random}.{ext}
 *
 * Generated files:
 * certificates/{certificateId}/{context}/{timestamp}-{random}-optimized.jpg
 * certificates/{certificateId}/{context}/{timestamp}-{random}-thumbnail.jpg
 */

const { Storage } = require('@google-cloud/storage');
const sharp = require('sharp');
const path = require('path');

const storage = new Storage();

// Configuration from environment
const OPTIMIZED_QUALITY = parseInt(process.env.OPTIMIZED_QUALITY || '90');
const THUMBNAIL_SIZE = parseInt(process.env.THUMBNAIL_SIZE || '200');
const MAX_OPTIMIZED_WIDTH = 2000;
const MAX_OPTIMIZED_HEIGHT = 2000;

// File patterns to process
const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp'];
const SKIP_PATTERNS = ['-optimized.', '-thumbnail.'];

/**
 * Cloud Function entry point
 * Triggered by Cloud Storage object.finalize event
 */
exports.processImage = async (cloudEvent) => {
  const file = cloudEvent.data;
  const bucketName = file.bucket;
  const fileName = file.name;
  const contentType = file.contentType;

  console.log(`Processing: gs://${bucketName}/${fileName}`);
  console.log(`Content-Type: ${contentType}`);

  // Skip if not an image
  if (!contentType || !contentType.startsWith('image/')) {
    console.log('Skipping: not an image file');
    return;
  }

  // Skip if not in certificates folder
  if (!fileName.startsWith('certificates/')) {
    console.log('Skipping: not in certificates folder');
    return;
  }

  // Skip if this is already a processed variant
  if (SKIP_PATTERNS.some(pattern => fileName.includes(pattern))) {
    console.log('Skipping: already a processed variant');
    return;
  }

  // Check file extension
  const ext = path.extname(fileName).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    console.log(`Skipping: unsupported extension ${ext}`);
    return;
  }

  try {
    const bucket = storage.bucket(bucketName);
    const originalFile = bucket.file(fileName);

    // Download original image
    console.log('Downloading original image...');
    const [originalBuffer] = await originalFile.download();
    console.log(`Original size: ${originalBuffer.length} bytes`);

    // Generate output paths
    const basePath = fileName.replace(/\.[^.]+$/, '');
    const optimizedPath = `${basePath}-optimized.jpg`;
    const thumbnailPath = `${basePath}-thumbnail.jpg`;

    // Create optimized version
    console.log('Creating optimized version...');
    const optimizedBuffer = await createOptimized(originalBuffer);
    console.log(`Optimized size: ${optimizedBuffer.length} bytes`);

    // Create thumbnail version
    console.log('Creating thumbnail...');
    const thumbnailBuffer = await createThumbnail(originalBuffer);
    console.log(`Thumbnail size: ${thumbnailBuffer.length} bytes`);

    // Upload optimized version
    console.log(`Uploading optimized to: ${optimizedPath}`);
    await bucket.file(optimizedPath).save(optimizedBuffer, {
      contentType: 'image/jpeg',
      metadata: {
        cacheControl: 'public, max-age=31536000',
        metadata: {
          originalFile: fileName,
          processedAt: new Date().toISOString(),
          variant: 'optimized',
          quality: OPTIMIZED_QUALITY.toString(),
        },
      },
    });

    // Upload thumbnail version
    console.log(`Uploading thumbnail to: ${thumbnailPath}`);
    await bucket.file(thumbnailPath).save(thumbnailBuffer, {
      contentType: 'image/jpeg',
      metadata: {
        cacheControl: 'public, max-age=31536000',
        metadata: {
          originalFile: fileName,
          processedAt: new Date().toISOString(),
          variant: 'thumbnail',
          size: THUMBNAIL_SIZE.toString(),
        },
      },
    });

    // Log compression stats
    const optimizedSavings = Math.round((1 - optimizedBuffer.length / originalBuffer.length) * 100);
    console.log(`Compression: ${optimizedSavings}% savings`);
    console.log(`Total storage: ${originalBuffer.length + optimizedBuffer.length + thumbnailBuffer.length} bytes`);

    console.log('Image processing complete');
  } catch (error) {
    console.error('Error processing image:', error);
    throw error; // Rethrow to trigger retry
  }
};

/**
 * Create optimized version of image
 * - Converts to JPEG with specified quality
 * - Resizes to max dimensions while maintaining aspect ratio
 */
async function createOptimized(buffer) {
  return sharp(buffer)
    .resize({
      width: MAX_OPTIMIZED_WIDTH,
      height: MAX_OPTIMIZED_HEIGHT,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({
      quality: OPTIMIZED_QUALITY,
      mozjpeg: true,
    })
    .toBuffer();
}

/**
 * Create thumbnail version of image
 * - 200x200 with cover fit (crops to fill)
 * - JPEG with good quality for small size
 */
async function createThumbnail(buffer) {
  return sharp(buffer)
    .resize({
      width: THUMBNAIL_SIZE,
      height: THUMBNAIL_SIZE,
      fit: 'cover',
      position: 'center',
    })
    .jpeg({
      quality: 85,
    })
    .toBuffer();
}
