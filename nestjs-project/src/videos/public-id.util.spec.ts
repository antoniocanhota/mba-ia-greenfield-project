import { generatePublicId, isPublicIdFormat } from './public-id.util';

describe('public-id.util', () => {
  describe('generatePublicId', () => {
    it('should generate 11 base64url characters', () => {
      for (let i = 0; i < 50; i++) {
        expect(generatePublicId()).toMatch(/^[A-Za-z0-9_-]{11}$/);
      }
    });

    it('should not repeat across a sample of generations', () => {
      const ids = new Set(Array.from({ length: 1000 }, generatePublicId));

      expect(ids.size).toBe(1000);
    });
  });

  describe('isPublicIdFormat', () => {
    it.each(['dQw4w9WgXcQ', 'abc_DEF-123', 'AAAAAAAAAAA'])(
      'should accept %s',
      (value) => {
        expect(isPublicIdFormat(value)).toBe(true);
      },
    );

    it.each([
      '',
      'short',
      'toolongvalue12',
      'has space!!',
      'accénted111',
      'abc+DEF/123',
    ])('should reject %j', (value) => {
      expect(isPublicIdFormat(value)).toBe(false);
    });

    it.each([undefined, null, 12345678901, {}])(
      'should reject the non-string %j',
      (value) => {
        expect(isPublicIdFormat(value)).toBe(false);
      },
    );
  });
});
