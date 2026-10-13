import {
  downloadBasename,
  downloadDisposition,
} from './download-disposition.util';

describe('download-disposition.util', () => {
  describe('downloadBasename', () => {
    it.each([
      ['My Trip.mov', 'My Trip'],
      ['clip.final.mkv', 'clip.final'],
      ['no-extension', 'no-extension'],
      ['.hidden', '.hidden'],
      ['   .mp4', 'video'],
      ['', 'video'],
    ])('should turn %j into %j', (input, expected) => {
      expect(downloadBasename(input)).toBe(expected);
    });
  });

  describe('downloadDisposition', () => {
    it('should name the attachment after the original file with an .mp4 extension', () => {
      expect(downloadDisposition('My Trip.mov')).toBe(
        `attachment; filename="My Trip.mp4"; filename*=UTF-8''My%20Trip.mp4`,
      );
    });

    it('should keep accents in filename* and replace them in the ASCII fallback', () => {
      const header = downloadDisposition('Férias na praia.mov');

      expect(header).toContain('filename="F_rias na praia.mp4"');
      expect(header).toContain("filename*=UTF-8''F%C3%A9rias%20na%20praia.mp4");
    });

    it('should not let quotes or backslashes break out of the quoted filename', () => {
      const header = downloadDisposition('a"b\\c%d.mov');

      expect(header).toContain('filename="a_b_c_d.mp4"');
      expect(header.match(/"/g)).toHaveLength(2);
    });

    it('should percent-encode the characters encodeURIComponent leaves alone', () => {
      expect(downloadDisposition("it's (1).mov")).toContain(
        "filename*=UTF-8''it%27s%20%281%29.mp4",
      );
    });
  });
});
