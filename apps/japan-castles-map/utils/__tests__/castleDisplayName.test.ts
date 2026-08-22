import { extractCastleAliases, formatChineseSubtitleLine } from '../castleDisplayName';

describe('castleDisplayName', () => {
  describe('extractCastleAliases', () => {
    it('extracts quoted aliases from descriptions', () => {
      const description = '別名「白鷺城」或「白鷺城（姫路）」';
      expect(extractCastleAliases(description)).toBe('白鷺城、白鷺城');
    });

    it('extracts 又名 aliases', () => {
      expect(extractCastleAliases('又名白鷺城（姫路），為日本代表名城。')).toBe('白鷺城');
    });

    it('returns null when no alias is present', () => {
      expect(extractCastleAliases('日本百名城之一。')).toBeNull();
    });
  });

  describe('formatChineseSubtitleLine', () => {
    it('joins Chinese name and alias with a dash', () => {
      expect(formatChineseSubtitleLine('姬路城', '白鷺城')).toBe('姬路城 – 白鷺城');
    });

    it('returns only the Chinese name when alias is missing', () => {
      expect(formatChineseSubtitleLine('  姬路城  ', null)).toBe('姬路城');
      expect(formatChineseSubtitleLine('姬路城', '   ')).toBe('姬路城');
    });
  });
});
