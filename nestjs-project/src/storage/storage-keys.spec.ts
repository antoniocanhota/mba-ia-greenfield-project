import {
  originalKey,
  publicObjectUrl,
  thumbnailKey,
  videoKey,
} from './storage-keys';

describe('storage-keys', () => {
  const publicId = 'abcDEF12345';

  it('should derive the object keys from the public id', () => {
    expect(originalKey(publicId)).toBe('videos/abcDEF12345/original');
    expect(videoKey(publicId)).toBe('videos/abcDEF12345/video.mp4');
    expect(thumbnailKey(publicId)).toBe('thumbnails/abcDEF12345.jpg');
  });

  it('should build a path-style public URL from the public endpoint and bucket', () => {
    expect(
      publicObjectUrl(
        'http://localhost:9000',
        'streamtube-videos',
        thumbnailKey(publicId),
      ),
    ).toBe(
      'http://localhost:9000/streamtube-videos/thumbnails/abcDEF12345.jpg',
    );
  });

  it('should not duplicate the slash when the endpoint has a trailing one', () => {
    expect(publicObjectUrl('http://localhost:9000/', 'b', 'k')).toBe(
      'http://localhost:9000/b/k',
    );
  });
});
