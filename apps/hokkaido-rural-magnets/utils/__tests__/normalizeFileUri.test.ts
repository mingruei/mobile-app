import { normalizeFileUri } from '../normalizeFileUri';

describe('normalizeFileUri', () => {
  it('preserves known URI schemes', () => {
    expect(normalizeFileUri('file:///tmp/a.jpg')).toBe('file:///tmp/a.jpg');
    expect(normalizeFileUri('content://media/external/images/1')).toBe(
      'content://media/external/images/1',
    );
    expect(normalizeFileUri('ph://asset-id')).toBe('ph://asset-id');
    expect(normalizeFileUri('assets-library://asset-id')).toBe('assets-library://asset-id');
  });

  it('adds file:// prefix to absolute paths', () => {
    expect(normalizeFileUri('/tmp/a.jpg')).toBe('file:///tmp/a.jpg');
  });

  it('trims whitespace and leaves other strings unchanged', () => {
    expect(normalizeFileUri('  https://example.com/a.jpg  ')).toBe('https://example.com/a.jpg');
    expect(normalizeFileUri('relative/path.jpg')).toBe('relative/path.jpg');
  });
});
