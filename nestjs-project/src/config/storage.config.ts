import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => ({
  endpoint: process.env.S3_ENDPOINT,
  publicEndpoint: process.env.S3_PUBLIC_ENDPOINT,
  region: process.env.S3_REGION || 'us-east-1',
  bucket: process.env.S3_BUCKET,
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  uploadSignTtlSeconds: parseInt(
    process.env.UPLOAD_SIGN_TTL_SECONDS || '3600',
    10,
  ),
  videoUrlTtlSeconds: parseInt(
    process.env.VIDEO_URL_TTL_SECONDS || '14400',
    10,
  ),
}));
