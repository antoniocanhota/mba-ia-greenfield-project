export const originalKey = (publicId: string): string =>
  `videos/${publicId}/original`;

export const videoKey = (publicId: string): string =>
  `videos/${publicId}/video.mp4`;

export const thumbnailKey = (publicId: string): string =>
  `thumbnails/${publicId}.jpg`;

export const THUMBNAILS_PREFIX = 'thumbnails/';

// Path-style URL on the browser-reachable endpoint; only valid for public-read keys.
export const publicObjectUrl = (
  publicEndpoint: string,
  bucket: string,
  key: string,
): string => `${publicEndpoint.replace(/\/+$/, '')}/${bucket}/${key}`;
