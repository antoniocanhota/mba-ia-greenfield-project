import { titleFromFilename } from './video-title.util';

describe('video-title.util', () => {
  describe('titleFromFilename', () => {
    it.each([
      ['holiday.mp4', 'holiday'],
      ['clip.final.mp4', 'clip.final'],
      ['semextensao', 'semextensao'],
    ])('should derive %s -> %s', (filename, title) => {
      expect(titleFromFilename(filename)).toBe(title);
    });

    it('should keep the full filename when stripping the extension leaves nothing', () => {
      expect(titleFromFilename('.mp4')).toBe('.mp4');
    });
  });
});
