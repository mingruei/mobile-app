import { formatDownloadProgressText } from '../downloadProgress';

describe('download progress text', () => {
  it('shows percent when total size is known', () => {
    expect(formatDownloadProgressText({ written: 5_242_880, expected: 10_485_760 })).toBe(
      '下載 50% · 5.0 MB / 10.0 MB',
    );
  });

  it('shows only written bytes when total is unknown', () => {
    expect(formatDownloadProgressText({ written: 2048, expected: null })).toBe('下載中 2 KB');
    expect(formatDownloadProgressText({ written: 0, expected: null })).toBe('等待下載…');
  });
});
