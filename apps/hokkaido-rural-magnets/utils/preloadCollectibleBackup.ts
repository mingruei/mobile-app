/** Warm the collectible backup module after first paint. */
export function preloadCollectibleBackup(): void {
  void import('./collectibleBackup');
}
