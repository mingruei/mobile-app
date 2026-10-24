export type DownloadProgress = {
  written: number;
  expected: number | null;
};

function formatByteSize(bytes: number): string {
  const value = Math.max(0, bytes);
  if (value >= 1_048_576) return `${(value / 1_048_576).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${Math.round(value)} B`;
}

export function formatDownloadProgressText(progress: DownloadProgress): string {
  const written = Math.max(0, progress.written);
  const expected = progress.expected && progress.expected > 0 ? progress.expected : null;
  if (expected) {
    const percent = Math.min(99, Math.floor((written / expected) * 100));
    return `下載 ${percent}% · ${formatByteSize(written)} / ${formatByteSize(expected)}`;
  }
  if (written > 0) return `下載中 ${formatByteSize(written)}`;
  return '等待下載…';
}
